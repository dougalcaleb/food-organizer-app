import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/*
CI authenticates by exchanging a GitHub OIDC token for the deploy role, and the
only thing standing between that role and anyone else's workflow is the `sub`
claim its trust policy matches. There is no way to exercise that from a test —
it happens between GitHub and STS — so it is guarded here as text.

The bug this exists for: GitHub issues the claim in two shapes. The classic one
is `repo:owner/name:ref:refs/heads/main`; the newer "immutable" one qualifies
both halves with numeric ids that a rename cannot recycle,
`repo:owner@1234/name@5678:ref:refs/heads/main`. This repository started
sending the immutable form against a policy listing only the classic one, and
every deploy failed with "Not authorized to perform sts:AssumeRoleWithWebIdentity"
— which reads exactly like a missing role or a missing variable, and sends you
looking everywhere but at the claim. CloudTrail's AssumeRoleWithWebIdentity
event carries the rejected `sub` verbatim; that is how to diagnose it next time.
*/

const root = resolve(__dirname, '..')
const template = readFileSync(resolve(root, 'infra/hosting.yaml'), 'utf8')
const deployScript = readFileSync(resolve(root, 'scripts/deploy.sh'), 'utf8')

const trustPolicy = template.slice(
	template.indexOf('  DeployRole:'),
	template.indexOf('      Policies:'),
)

const publishPolicy = template.slice(
	template.indexOf('        - PolicyName: publish-site'),
	template.indexOf('  BackupBucket:'),
)

describe('deploy role trust policy', () => {
	it('accepts the classic subject claim', () => {
		expect(trustPolicy).toContain(
			"'repo:${GitHubOwner}/${GitHubRepo}:ref:refs/heads/${GitHubBranch}'",
		)
	})

	it('accepts the immutable subject claim, which is what GitHub now sends', () => {
		expect(trustPolicy).toContain(
			"'repo:${GitHubOwner}@${GitHubOwnerId}/${GitHubRepo}@${GitHubRepoId}:ref:refs/heads/${GitHubBranch}'",
		)
	})

	/*
	Matching both shapes with one `repo:${GitHubOwner}*` pattern would be
	shorter and would also hand the role to any account registered as
	`dougalcaleb2`. The ids are what make the second pattern exact.
	*/
	it('has both ids to build that claim from', () => {
		expect(template).toMatch(/^ {2}GitHubOwnerId:$/m)
		expect(template).toMatch(/^ {2}GitHubRepoId:$/m)
	})

	it('never widens the owner or repo to a wildcard', () => {
		expect(trustPolicy).not.toMatch(/repo:\$\{GitHubOwner\}\*/)
		expect(trustPolicy).not.toContain("'repo:*")
	})

	// A branch wildcard would let a pull request branch deploy to production.
	it('pins the branch', () => {
		expect(trustPolicy).not.toContain('refs/heads/*')
		expect(trustPolicy.match(/refs\/heads\/\$\{GitHubBranch\}/g)).toHaveLength(2)
	})
})

/*
The role is scoped down to exactly what `scripts/deploy.sh` does, which means
the two drift apart quietly: a missing grant is not a syntax error anywhere,
and locally the script runs with whatever admin credentials you already have.
It only fails in CI, as an `aws` exit code 254 that the workflow reports as
"Process completed with exit code 254" with the actual AccessDenied message
buried in the step's own output.

Reading the stack outputs was the one that got missed — deploy.sh looks the
bucket and distribution up rather than hard-coding them, and `DescribeStacks`
is a permission like any other.
*/
describe('deploy role permissions', () => {
	const needs: [string, RegExp, string][] = [
		[
			'reads the stack outputs',
			/aws cloudformation describe-stacks/,
			'cloudformation:DescribeStacks',
		],
		['lists the bucket to diff against', /aws s3 sync/, 's3:ListBucket'],
		['uploads the build', /aws s3 sync/, 's3:PutObject'],
		['sweeps replaced assets', /--delete/, 's3:DeleteObject'],
		[
			'invalidates the unhashed files',
			/aws cloudfront create-invalidation/,
			'cloudfront:CreateInvalidation',
		],
	]

	it.each(needs)('%s', (_what, call, action) => {
		expect(deployScript).toMatch(call)
		expect(publishPolicy).toContain(action)
	})

	// CI publishes files. Changing infrastructure is a thing you do by hand,
	// with your own credentials, via `npm run infra`.
	it('cannot alter the stack it reads', () => {
		expect(publishPolicy).not.toMatch(/cloudformation:(?!DescribeStacks)/)
	})
})
