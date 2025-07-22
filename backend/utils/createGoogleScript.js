import { google } from 'googleapis';
import path from 'path';
import { fileURLToPath } from 'url';

// 📍 __dirname workaround for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🔐 Auth setup using your service account key
const auth = new google.auth.GoogleAuth({
  keyFile: path.join(__dirname, '../config/service-account-creds.json'), // ✅ Ensure this file exists!
  scopes: [
    'https://www.googleapis.com/auth/script.projects',
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/script.deployments',
    'https://www.googleapis.com/auth/script.scriptapp'
  ]
});

/**
 * Creates a Google Apps Script that sends email submissions
 * @param {string} userEmail - The user's email to receive contact form submissions
 * @returns {Promise<string>} The URL of the deployed web app (form endpoint)
 */
export async function createContactFormScript(userEmail) {
  const authClient = await auth.getClient();
  const script = google.script({ version: 'v1', auth: authClient });

  // Step 1: Create a new Apps Script project
  const createRes = await script.projects.create({
    requestBody: { title: `ContactFormScript_${Date.now()}` }
  });

  const scriptId = createRes.data.scriptId;

  // Step 2: Inject .gs script code that sends email to userEmail
  const sourceCode = `
function doPost(e) {
  var email = "${userEmail}";
  var message = "New contact form submission:\\n\\n";
  for (var key in e.parameter) {
    message += key + ": " + e.parameter[key] + "\\n";
  }
  MailApp.sendEmail(email, "Website Contact Form", message);
  return ContentService.createTextOutput("Success");
}
`;

  await script.projects.updateContent({
    scriptId,
    requestBody: {
      files: [
        {
          name: 'Code',
          type: 'SERVER_JS',
          source: sourceCode
        },
        {
          name: 'appsscript',
          type: 'JSON',
          source: JSON.stringify({
            timeZone: 'Europe/London',
            exceptionLogging: 'STACKDRIVER',
            webapp: {
              access: 'ANYONE',
              executeAs: 'USER_ACCESSING'
            }
          })
        }
      ]
    }
  });

  // Step 3: Create new version for deployment
  const versionRes = await script.projects.versions.create({
    scriptId,
    requestBody: { description: 'Initial version' }
  });

  const versionNumber = versionRes.data.versionNumber;

  // Step 4: Deploy it as a web app
  const deployRes = await script.projects.deployments.create({
    scriptId,
    requestBody: {
      versionNumber,
      manifestFileName: 'appsscript',
      deploymentConfig: {
        description: 'Deployed contact form endpoint',
        entryPointConfig: {
          type: 'WEB_APP',
          webApp: {
            access: 'ANYONE_ANONYMOUS',
            executeAs: 'USER_ACCESSING'
          }
        }
      }
    }
  });

  // Step 5: Return the deployed Web App URL
  const entryPoint = deployRes.data.entryPoints?.find(p => p.type === 'WEB_APP');
  return entryPoint?.url || null;
}
