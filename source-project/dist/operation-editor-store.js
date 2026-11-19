(function(root){
const KEY='izdelie-operation-drafts-v1';let active=null,scope='default';
function all(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return {}}}
function key(id,type){return JSON.stringify([scope,id||'new-'+type])}
function save(draft){active=structuredClone(draft);const drafts=all();drafts[key(draft.id,draft.operation.type)]=active;try{localStorage.setItem(KEY,JSON.stringify(drafts));return true}catch{return false}}
function load(id,type){return all()[key(id,type)]||null}
function clear(id,type){const drafts=all();delete drafts[key(id,type)];try{localStorage.setItem(KEY,JSON.stringify(drafts))}catch{}active=null}
root.OperationEditorStore={save,load,clear,setScope:value=>{scope=value},current:()=>active};
})(typeof window!=='undefined'?window:globalThis);
