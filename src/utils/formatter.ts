import { RetrieveUserQuotaSummaryResponse } from './types';

/**
 * Formats the RetrieveUserQuotaSummaryResponse exactly like the original Go CLI output.
 */
export function formatQuotaSummary(quotaResp: RetrieveUserQuotaSummaryResponse): string {
	let output = '';

	const groups = quotaResp.response?.groups || [];
	if (groups.length === 0) {
		return 'No quota groups found.\n';
	}

	for (const group of groups) {
		output += `=== ${group.displayName} ===\n`;
		if (group.description) {
			output += `Description: ${group.description}\n`;
		}
		output += '\n';

		const buckets = group.buckets || [];
		for (const bucket of buckets) {
			output += `  • ${bucket.displayName}\n`;
			output += `    Remaining:   ${(bucket.remainingFraction * 100).toFixed(1)}%\n`;
			if (bucket.description) {
				output += `    Info:        ${bucket.description}\n`;
			}
			if (bucket.resetTime) {
				output += `    Reset Time:  ${bucket.resetTime}\n`;
			}
			output += '\n';
		}
	}

	if (quotaResp.response?.description) {
		output += `Note: ${quotaResp.response.description}\n`;
	}

	return output;
}
