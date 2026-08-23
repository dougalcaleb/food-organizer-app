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

const template = readFileSync(resolve(__dirname, '..', 'infra/hosting.yaml'), 'utf8')

const trustPolicy = template.slice(
	template.indexOf('  DeployRole:'),
	template.indexOf('      Policies:'),
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
