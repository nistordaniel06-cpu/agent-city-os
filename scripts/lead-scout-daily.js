'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {scout} = require('../lead-scout');
async function main(){
 const report = await scout();
 // Never overwrite the last known list with a total upstream outage.
 if(report.errors.length === 4 && !report.results.length) {
   console.error('All external public sources failed; daily file preserved.', report.errors);
   process.exitCode = 1;
   return;
 }
 const out = path.join(__dirname,'..','public','leads-daily.json');
 fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n','utf8');
 console.log('Daily client signals:',report.results.length,'Errors:',report.errors.length,'No outreach sent.');
}
if(require.main===module)main().catch(e=>{console.error('Hunter daily failed:',e.message);process.exitCode=1});
module.exports={main};
