import {spawn} from 'node:child_process';
import net from 'node:net';
const check=net.createServer();
check.once('error',()=>{console.error('Port 5000 is already used. Close the terminal running your previous backend, then try again.');process.exitCode=1;});
check.listen(5000,'127.0.0.1',()=>check.close(()=>{
 const backend=spawn(process.execPath,['server.js'],{stdio:'inherit',env:{...process.env,PORT:'5000'}});
 const frontend=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','localhost','--port','5173','--strictPort','--open'],{stdio:'inherit'});
 const stop=()=>{backend.kill();frontend.kill();};
 process.on('SIGINT',()=>{stop();process.exit();});
 process.on('exit',stop);
 backend.on('exit',()=>frontend.kill());
 frontend.on('exit',()=>backend.kill());
 console.log('Keep this window open while using the demo. Press Ctrl+C to stop.');
}));
