import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/*
The cloud backup's infrastructure has no way to be exercised from a test — it
is CloudFormation and a Lambda that only exists in AWS — so this guards the two
things about it that fail silently, as text.

The sharp one: the distribution rewrites 403 and 404 to index.html with a 200
so the SPA can cold-load any path, and CloudFormation gives no way to scope
that to a single behavior. An API answering 404 for "no backup yet" therefore
reaches the browser as an HTML page with a success status. Nothing errors;
`response.json()` throws somewhere unrelated and the backup looks broken for a
reason nothing points at.
*/

const root = resolve(__dirname, '..')
const template = readFileSync(resolve(root, 'infra/hosting.yaml'), 'utf8')
const infraScript = readFileSync(resolve(root, 'scripts/infra.sh'), 'utf8')

/** The inline handler, comments stripped so prose about 403 does not count. */
const lambdaCode = template
	.slice(template.indexOf('ZipFile: |'), template.indexOf('  BackupFunctionUrl:'))
	.split('\n')
	.filter((line) => !line.trim().startsWith('//'))
	.join('\n')

describe('backup lambda', () => {
	it('is actually inline in the template', () => {
		expect(lambdaCode).toContain('exports.handler')
	})

	it.each(['403', '404'])('never answers %s, which the SPA fallback would swallow', (status) => {
		expect(lambdaCode).not.toContain(status)
	})

	it('answers a missing backup with a 200 the client can read', () => {
		expect(lambdaCode).toContain('present: false')
	})

	it('uses 401 for a bad token, which passes through untouched', () => {
		expect(lambdaCode).toContain('401')
	})

	/*
	The other half of the empty-database guard in lib/cloudBackup.ts. A
	client-side-only check is one bad build away from writing an evicted,
	empty database over the only good backup.
	*/
	it('refuses to store a backup with no meals', () => {
		expect(lambdaCode).toContain('parsed.meals.length === 0')
	})
})

describe('backup storage', () => {
	it('versions the bucket, so a bad write can be rolled back', () => {
		const bucket = template.slice(
			template.indexOf('  BackupBucket:'),
			template.indexOf('  BackupFunctionRole:'),
		)

		expect(bucket).toContain('VersioningConfiguration')
		expect(bucket).toContain('Status: Enabled')
	})

	/*
	The token is public by design — it ships in the bundle — but an empty one
	must close the endpoint rather than open it, so a stack deployed without
	one is not a writable object store on the internet.
	*/
	it('defaults the token to empty', () => {
		const parameter = template.slice(
			template.indexOf('  BackupToken:'),
			template.indexOf('Resources:'),
		)

		expect(parameter).toContain("Default: ''")
	})
})

/*
The token is public by design, so it lives in a tracked source file that both
the build and `npm run infra` read — a source file rather than a `.env`
because `.env` is what crawlers grep public repos for.

`infra.sh` matches that file as text, so the shape of the declaration is load
bearing. Reformat it and the script stops finding a token, concludes there is
none, and generates a replacement — quietly rotating the deployed one out from
under the last-built bundle.
*/
describe('backup token wiring', () => {
	const tokenFile = readFileSync(resolve(root, 'src/lib/backupToken.ts'), 'utf8')

	it('declares the token in the single-quoted shape infra.sh matches', () => {
		expect(tokenFile).toMatch(/^export const BACKUP_TOKEN = '[^']*'$/m)
	})

	it('is read and deployed from that one file', () => {
		expect(infraScript).toContain('src/lib/backupToken.ts')
		expect(infraScript).toContain('BACKUP_TOKEN')
		expect(infraScript).toContain('BackupToken=$TOKEN')
	})
})

describe('cost alarm', () => {
	/*
	The endpoint is open to anyone holding the token, nothing rate-limits it,
	and even a 401 costs an invocation — so the alarm is the backstop for the
	one quantity in this stack that has no ceiling.
	*/
	it('exists and alerts on both actual and forecast spend', () => {
		expect(template).toContain('AWS::Budgets::Budget')
		expect(template).toContain('NotificationType: ACTUAL')
		expect(template).toContain('NotificationType: FORECASTED')
	})

	/*
	This account runs other, larger projects. An account-wide budget set low
	enough to notice a few dollars of Lambda here would fire constantly on
	things unrelated to it, and an alarm that cries wolf gets ignored — so the
	budget is filtered to a cost allocation tag.
	*/
	it('is scoped by tag rather than covering the whole account', () => {
		expect(template).toContain('CostFilters')
		expect(template).toContain('TagKeyValue')
	})

	/*
	The filter only matches because `infra.sh` applies the same tag to the
	stack. Change one side alone and nothing errors — the budget simply matches
	no spend and never fires, which is indistinguishable from everything being
	fine.
	*/
	it('filters on exactly the tag infra.sh applies', () => {
		const filtered = template.match(/user:([A-Za-z0-9]+)\$([^']+)'/)
		const applied = infraScript.match(/--tags ([A-Za-z0-9]+)=(\S+)/)

		expect(filtered).not.toBeNull()
		expect(applied).not.toBeNull()
		expect([filtered?.[1], filtered?.[2]]).toEqual([applied?.[1], applied?.[2]])
	})

	it('is off unless an address was supplied, so nobody is emailed by accident', () => {
		expect(template).toContain('Condition: HasBudgetAlert')
	})

	// This repository is public. The address is a parameter for that reason,
	// and must never be inlined for convenience.
	it('carries no email address in the template', () => {
		expect(template).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)
	})
})

/*
A public function URL takes two resource-based permissions, and granting only
the obvious one produces an endpoint that is completely dead while every
individual setting reads as correct: AuthType is NONE, get-policy returns the
lambda:InvokeFunctionUrl grant exactly as documented, and Lambda still refuses
every request -- anonymous and signed alike -- with 403 AccessDeniedException,
before the handler. The log group having no streams at all is the tell.

Since October 2025 lambda:InvokeFunction is required as well. The console and
AWS SAM add both statements silently, so most examples in the wild show only
the first and look complete; CloudFormation adds neither for you.

Through the distribution that 403 becomes the SPA fallback, which is why the
app's symptom is the generic "returned something unexpected" rather than
anything pointing here.
*/
describe('backup function url permissions', () => {
	const permissions = template.slice(
		template.indexOf('  BackupFunctionUrlPermission:'),
		template.indexOf('  # ── Cost alarm'),
	)

	it('opens the url to an anonymous caller, which is the whole design', () => {
		expect(permissions).toContain('Action: lambda:InvokeFunctionUrl')
		expect(permissions).toContain('FunctionUrlAuthType: NONE')
	})

	it('also grants InvokeFunction, without which the url is refused outright', () => {
		expect(permissions).toContain('Action: lambda:InvokeFunction\n')
	})

	/*
	`Principal: '*'` on lambda:InvokeFunction is only safe because of this: it
	confines the grant to calls arriving through the URL. Without it, anyone
	with AWS credentials could invoke the function directly and skip the bearer
	check entirely.
	*/
	it('confines the invoke grant to calls through the url', () => {
		expect(permissions).toContain('InvokedViaFunctionUrl: true')
	})
})

describe('backup api routing', () => {
	const behavior = template.slice(
		template.indexOf('- PathPattern: /api/backup'),
		template.indexOf('DefaultCacheBehavior:'),
	)

	it('forwards the methods the client uses', () => {
		expect(behavior).toContain('PUT')
		expect(behavior).toContain('GET')
	})

	it('caches nothing', () => {
		// Managed-CachingDisabled. A cached backup response would be a stale one.
		expect(behavior).toContain('4135ea2d-6df8-44a3-9df3-4b5a84be39ad')
	})

	it('forwards Authorization but not Host', () => {
		// Managed-AllViewerExceptHostHeader: the function needs the bearer token,
		// and a Lambda function URL rejects a request carrying someone else's Host.
		expect(behavior).toContain('b689b0a8-53d0-40ab-baf2-68738e2966ac')
	})
})
