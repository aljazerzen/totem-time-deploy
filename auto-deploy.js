require('dotenv').config();

const crypto = require('crypto');
const bodyParser = require('body-parser');
const express = require('express');

const app = express();
app.use(bodyParser.raw({ type: '*/*' }));

export function run(command, ...args) {
  const child = spawn(command, args);

  const stdout = [];
  child.stdout.on('data', chunk => stdout.push(chunk));

  const stderr = [];
  child.stderr.on('data', chunk => stderr.push(chunk));

  return new Promise(resolve => {
    child.on('close', code => {
      if (code) {
        stdout.forEach(chunk => process.stdout.write(chunk));
        stderr.forEach(chunk => process.stderr.write(chunk));
        process.exit(code);
      }
      resolve();
    });
  });
}


function checkSignature(req, res, next) {
  if (process.env.SECRET && !req.headers['x-hub-signature']) {
    return next('signature missing');
  }

  const signature = crypto.createHmac('sha1', process.env.SECRET).update(req.body).digest('hex');

  if ('sha1=' + signature !== req.headers['x-hub-signature'])
    return next('signature invalid');

  next();
}

app.post('/api', checkSignature, async (req, res) => {
  let body = JSON.parse(req.body);
  console.log('web hook received: ' + req.headers['x-github-event']);

  console.log(req.headers);
  console.log(body);

  if (req.headers['x-github-event'] === 'push') {
    const branch = body.ref.split('/').pop();
    console.log('branch: ' + branch);
    if (branch === process.env.BRANCH) {
      call(process.env.DEPLOY_API_SCRIPT);
    }
  }

  res.status(200).send();
});

app.listen(process.env.AUTO_DEPLOY_PORT, () => {
  console.log('listening at port', process.env.AUTO_DEPLOY_PORT);
});