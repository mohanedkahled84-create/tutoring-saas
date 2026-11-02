type QueueService={processScheduledQueue():Promise<unknown>};
// The durable queue owns retries-before-send. Each actual send is still
// atomically claimed in Postgres, including across multiple server processes.
export function createMetaPortalWorker(service:QueueService,onError:()=>void=()=>{}){
 let running=false,stopped=false;
 return {
  async tick(){
   if(running || stopped)return false;
   running=true;
   try{await service.processScheduledQueue();return true;}catch{onError();return false;}finally{running=false;}
  },
  stop(){stopped=true;},
 };
}
