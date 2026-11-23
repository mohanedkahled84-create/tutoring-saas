/** A provider acceptance is not proof of delivery; legacy failures may be ambiguous. */
export function portalDeliveryStatus(row:{status:string;error_message?:string|null},receipt?:string|null):string {
 if(receipt)return receipt;
 if(row.status==='sent')return 'accepted';
 if(row.status==='failed')return row.error_message==='PORTAL_NOT_SENT'?'not_sent':'unknown';
 return row.status;
}
