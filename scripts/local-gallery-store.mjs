// Loopback preview/test adapter only. Production uses platform D1 and R2 bindings.
import {DatabaseSync} from 'node:sqlite';
import {mkdir,readFile,writeFile,unlink,readdir} from 'node:fs/promises';
import path from 'node:path';
export async function localStore(directory,migrations){
  await mkdir(directory,{recursive:true});const sqlite=new DatabaseSync(path.join(directory,'gallery.sqlite'));
  sqlite.exec('PRAGMA foreign_keys = ON; CREATE TABLE IF NOT EXISTS local_migrations (name TEXT PRIMARY KEY)');
  for(const filename of (await readdir(migrations)).filter(v=>v.endsWith('.sql')).sort()){
    if(sqlite.prepare('SELECT name FROM local_migrations WHERE name = ?').get(filename))continue;
    sqlite.exec('BEGIN');try{sqlite.exec(await readFile(path.join(migrations,filename),'utf8'));sqlite.prepare('INSERT INTO local_migrations VALUES (?)').run(filename);sqlite.exec('COMMIT');}catch(error){sqlite.exec('ROLLBACK');throw error;}
  }
  function prepare(sql,args=[]){
    function execute(){const stmt=sqlite.prepare(sql);if(stmt.columns().length){const results=stmt.all(...args);return {success:true,results,meta:{changes:Number(sqlite.prepare('SELECT changes() AS n').get().n)}};}const result=stmt.run(...args);return {success:true,results:[],meta:{changes:Number(result.changes)}};}
    return {bind:(...values)=>prepare(sql,values),first:async()=>execute().results[0]??null,all:async()=>execute(),run:async()=>execute(),execute};
  }
  const DB={prepare,async batch(statements){sqlite.exec('BEGIN');try{const result=statements.map(v=>v.execute());sqlite.exec('COMMIT');return result;}catch(error){sqlite.exec('ROLLBACK');throw error;}}};
  const blobRoot=path.join(directory,'photos');await mkdir(blobRoot,{recursive:true});
  function filename(key){if(!/^gallery\/[a-f0-9]{12}\/[a-f0-9-]{36}$/.test(key))throw new Error('Invalid local blob key');return path.join(blobRoot,key.replaceAll('/','_'));}
  const BUCKET={async put(key,bytes){await writeFile(filename(key),bytes);},async get(key){try{return {body:new Uint8Array(await readFile(filename(key)))};}catch(error){if(error.code==='ENOENT')return null;throw error;}},async delete(key){await unlink(filename(key)).catch(error=>{if(error.code!=='ENOENT')throw error;});}};
  return {DB,BUCKET,close:()=>sqlite.close()};
}
