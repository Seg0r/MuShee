#!/usr/bin/env node

/**
 * Script to generate CHANGELOG entry using Google Gemini API
 *
 * Usage: node generate-changelog-entry.js "<commits>" "<date_from>" "<date_to>"
 *
 * Commits format: "hash|date|message\nhash|date|message..."
 */

const https = require('https');

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

if (!GOOGLE_API_KEY) {
  console.error('Error: GOOGLE_API_KEY environment variable is not set');
  process.exit(1);
}

const commitsData = process.argv[2];
const dateFrom = process.argv[3];
const dateTo = process.argv[4];

if (!commitsData || !dateFrom || !dateTo) {
  console.error('Error: Missing required arguments');
  console.error('Usage: node generate-changelog-entry.js "<commits>" "<date_from>" "<date_to>"');
  process.exit(1);
}

// Parse commits
const commits = commitsData
  .split('\n')
  .filter(line => line.trim())
  .map(line => {
    const [hash, date, ...messageParts] = line.split('|');
    return {
      hash: hash?.trim(),
      date: date?.trim(),
      message: messageParts.join('|').trim(),
    };
  })
  .filter(commit => commit.hash && commit.message);

if (commits.length === 0) {
  console.error('Error: No commits found');
  process.exit(1);
}

// Format dates from YYYY-MM-DD to DD.MM.YYYY
function formatDate(dateStr) {
  const [year, month, day] = dateStr.split('-');
  return `${day}.${month}.${year}`;
}

const formattedDateFrom = formatDate(dateFrom);
const formattedDateTo = formatDate(dateTo);

// Format commits for prompt
const commitsText = commits
  .map((commit, index) => {
    return `${index + 1}. ${commit.message} (${commit.date})`;
  })
  .join('\n');

// Create prompt with formatted dates
const finalPrompt = `You are an expert at analyzing code changes. Analyze the following commits from the MuShee repository (a sheet music library management application) and generate a concise summary of changes in English.

List of commits:
${commitsText}

Task:
1. Analyze all commits and identify the main categories of changes
2. Group similar changes together
3. Generate a list of bullet points summarizing the changes in English
4. Each point should be concise and descriptive
5. Use impersonal form (e.g., "Implemented...", "Updated...", "Added...")
6. Maximum 10 points, focus on the most important changes

Output format - return ONLY the changelog section in the format:
### ${formattedDateFrom} - ${formattedDateTo}

- Change description 1
- Change description 2
- Change description 3

IMPORTANT: Return ONLY the changelog section (no additional comments, no markdown code blocks, no "MuShee - Changelog" header).`;

// Prepare request data
const requestData = JSON.stringify({
  contents: [
    {
      parts: [
        {
          text: finalPrompt,
        },
      ],
    },
  ],
  generationConfig: {
    temperature: 0.7,
    topK: 40,
    topP: 0.95,
    maxOutputTokens: 1024,
  },
});

const options = {
  hostname: 'generativelanguage.googleapis.com',
  path: `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${GOOGLE_API_KEY}`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': requestData.length,
  },
};

// Make API request
const req = https.request(options, res => {
  let data = '';

  res.on('data', chunk => {
    data += chunk;
  });

  res.on('end', () => {
    if (res.statusCode !== 200) {
      console.error(`Error: API returned status ${res.statusCode}`);
      console.error('Response:', data);
      process.exit(1);
    }

    try {
      const response = JSON.parse(data);

      if (response.error) {
        console.error('API Error:', response.error.message || response.error);
        process.exit(1);
      }

      const text = response.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        console.error('Error: No text in API response');
        console.error('Response:', JSON.stringify(response, null, 2));
        process.exit(1);
      }

      // Clean up the response (remove markdown code blocks if present)
      let cleanedText = text.trim();

      // Remove markdown code blocks if present
      cleanedText = cleanedText.replace(/^```[\w]*\n?/gm, '');
      cleanedText = cleanedText.replace(/```$/gm, '');
      cleanedText = cleanedText.trim();

      // Ensure the date format matches what we expect
      // Replace any date format in the output with our formatted dates
      cleanedText = cleanedText.replace(
        /###\s*\d{4}-\d{2}-\d{2}\s*-\s*\d{4}-\d{2}-\d{2}/,
        `### ${formattedDateFrom} - ${formattedDateTo}`
      );

      // Output to stdout for workflow to capture
      console.log(cleanedText);
    } catch (error) {
      console.error('Error parsing API response:', error.message);
      console.error('Response data:', data);
      process.exit(1);
    }
  });
});

req.on('error', error => {
  console.error('Error making API request:', error.message);
  process.exit(1);
});

req.write(requestData);
req.end();
