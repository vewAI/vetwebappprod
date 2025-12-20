const http = require('http');

function postOnce(host='localhost', port=3000, path='/api/merck-public-test', query='mastitis in cattle'){
  return new Promise((resolve, reject)=>{
    const data = JSON.stringify({query});
    const options = { hostname: host, port, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } };
    const req = http.request(options, res=>{
      let body=''; res.on('data', d=>body+=d); res.on('end', ()=>{ resolve({ status: res.statusCode, body }) });
    });
    req.on('error', err=> reject(err));
    req.write(data); req.end();
  });
}

(async function(){
  const host = process.argv[2] || 'localhost';
  const port = Number(process.argv[3] || 3000);
  for (let i=0;i<12;i++){
    try{
      const r = await postOnce(host,port);
      console.log('status', r.status);
      try{ console.log(JSON.parse(r.body)); } catch(e){ console.log(r.body); }
      process.exit(0);
    }catch(err){
      console.error('attempt',i,'failed', err.code||err.message);
      await new Promise(res=>setTimeout(res, 2000));
    }
  }
  console.error('all attempts failed'); process.exit(2);
})();
