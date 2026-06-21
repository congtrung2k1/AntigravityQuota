import * as Module from 'module';
import * as fs from 'fs';
import * as path from 'path';

// 1. Inject VS Code mock so we can run outside the editor host
const mockVscode = {
	window: {
		createOutputChannel: () => ({
			appendLine: () => {},
			show: () => {}
		}),
		createStatusBarItem: () => ({
			show: () => {},
			dispose: () => {}
		}),
		showErrorMessage: () => Promise.resolve(),
		showInformationMessage: () => Promise.resolve(),
	},
	ThemeColor: class {},
	StatusBarAlignment: { Right: 1, Left: 2 },
	ConfigurationTarget: { Global: 1, Workspace: 2 },
	workspace: {
		getConfiguration: () => ({
			get: () => [],
			update: () => Promise.resolve(),
		})
	}
};

const originalResolveFilename = (Module as any)._resolveFilename;
(Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean) {
	if (request === 'vscode') {
		return 'vscode';
	}
	return originalResolveFilename.apply(this, arguments);
};

require.cache['vscode'] = {
	id: 'vscode',
	filename: 'vscode',
	loaded: true,
	exports: mockVscode,
	parent: null,
	paths: []
} as any;

// 2. Import core dependencies
import { ProcessFinder } from './core/process_finder';
import { QuotaManager } from './core/quota_manager';
import { formatQuotaSummary } from './utils/formatter';
import { RetrieveUserQuotaSummaryResponse } from './utils/types';

async function run() {
	console.log('=== Antigravity Quota Extension Core Test Runner ===\n');

	// 3. Test Formatter on Static Mock Data
	console.log('--- Testing Formatter on Static Baseline Data ---');
	const mockDataPath = path.join(__dirname, 'static_quota_mock.json');
	let mockData: RetrieveUserQuotaSummaryResponse;
	try {
		const rawMock = fs.readFileSync(mockDataPath, 'utf8');
		mockData = JSON.parse(rawMock);
	} catch (e: any) {
		// Fallback if running from compiled location (export/)
		const fallbackPath = path.join(__dirname, '..', 'src', 'static_quota_mock.json');
		const rawMock = fs.readFileSync(fallbackPath, 'utf8');
		mockData = JSON.parse(rawMock);
	}

	const formattedMock = formatQuotaSummary(mockData);
	console.log(formattedMock);
	console.log('--- Static Baseline Format Test: PASSED ---\n');

	// 4. Resolve Live Credentials (Process Finder or Env Fallback)
	console.log('--- Detecting Language Server Connection ---');
	let port = 0;
	let token = '';

	const finder = new ProcessFinder();
	const processInfo = await finder.detect_process_info();

	if (processInfo) {
		port = processInfo.connect_port;
		token = processInfo.csrf_token;
		console.log(`Detected via ProcessFinder: Port ${port}, Token: ${token.substring(0, 8)}...`);
	} else {
		console.log('ProcessFinder could not auto-detect the running language server process.');
		if (process.env.ANTIGRAVITY_LS_ADDRESS && process.env.ANTIGRAVITY_CSRF_TOKEN) {
			const addr = process.env.ANTIGRAVITY_LS_ADDRESS;
			port = parseInt(addr.split(':')[1] || addr, 10);
			token = process.env.ANTIGRAVITY_CSRF_TOKEN;
			console.log(`Using Environment Fallback: Port ${port}, Token: ${token.substring(0, 8)}...`);
		}
	}

	if (!port || !token) {
		console.error('\nError: Could not resolve language server address or token from processes or env variables.');
		process.exit(1);
	}

	// 5. Test Live Fetching & Formatting
	console.log('\n--- Fetching Live Quota Summary from Language Server ---');
	const manager = new QuotaManager();
	manager.init(port, token);

	try {
		const liveData = await manager.fetch_quota_summary();
		console.log('Successfully retrieved response from server!\n');

		console.log('--- Live Formatted Output ---');
		const formattedLive = formatQuotaSummary(liveData);
		console.log(formattedLive);

		// Basic sanity validation
		if (!liveData.response || !Array.isArray(liveData.response.groups)) {
			throw new Error('Response format is missing expected "response.groups" array');
		}
		console.log('--- Live Validation: PASSED ---');
		console.log('\nAll tests completed successfully!');
	} catch (e: any) {
		console.error('\nFailed to fetch or validate live quota summary:', e.message);
		process.exit(1);
	}
}

run().catch(err => {
	console.error('Unhandled runner exception:', err);
	process.exit(1);
});
