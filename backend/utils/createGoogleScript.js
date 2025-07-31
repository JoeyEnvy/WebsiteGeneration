import { google } from 'googleapis';

const creds = JSON.parse(process.env.GOOGLE_CREDS_JSON);

const auth = new google.auth.GoogleAuth({
  credentials: creds,
  scopes: [
    'https://www.googleapis.com/auth/script.projects',
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/script.deployments',
    'https://www.googleapis.com/auth/script.scriptapp'
  ]
});

export async function createContactFormScript(userEmail) {
  const authClient = await auth.getClient();
  const script = google.script({ version: 'v1', auth: authClient });

  const createRes = await script.projects.create({
    requestBody: { title: `ContactFormScript_${Date.now()}` }
  });

  const scriptId = createRes.data.scriptId;

  const sourceCode = `
function doPost(e) {
  var email = ${JSON.stringify(userEmail)};
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

  const versionRes = await script.projects.versions.create({
    scriptId,
    requestBody: { description: 'Initial version' }
  });

  const versionNumber = versionRes.data.versionNumber;

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

  const entryPoint = deployRes.data.entryPoints?.find(p => p.type === 'WEB_APP');
  if (!entryPoint?.url) throw new Error('Failed to retrieve deployed web app URL.');

  return entryPoint.url;
}

