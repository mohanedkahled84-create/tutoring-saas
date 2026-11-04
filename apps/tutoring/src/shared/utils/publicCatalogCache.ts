/** Only public, identical-for-everyone catalog data belongs here. Never user data. */
export function publicCatalogCache<T>(load:()=>Promise<T>,ttlMs=60_000,clock=Date.now) {
  let saved:{value:T;expires:number}|undefined;
  let flight:Promise<T>|undefined;
  return function read():Promise<T> {
    if(saved && clock()<saved.expires)return Promise.resolve(saved.value);
    if(flight)return flight;
    flight=Promise.resolve().then(load).then(value=>{
      saved={value,expires:clock()+ttlMs};
      return value;
    }).finally(()=>{flight=undefined;});
    return flight;
  };
}
