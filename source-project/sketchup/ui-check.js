/* Execute in a loaded test HtmlDialog with a cj_probe callback. Never persists. */
(async function(){
 const before=JSON.stringify(state),stored=localStorage.getItem('izdelie-state'),original=window.sketchup.cj_request;
 const assert=(ok,message)=>{if(!ok)throw Error(message);};
 try{
  const part={id:'p-9001',occurrence:'9001',name:'Тест <img src=x onerror="alert(1)">',kind:'Group',material:null,dimensions_m:[1,.2,.03],surface_area_m2:.472,face_area_m2:null,edge_length_m:4.92,volume_m3:.006,notes:[]};
  const packet={format:'cj-sketchup-selection',version:1,model_id:'synthetic-ui-model',model_name:'Синтетический UI-тест',revision:'test-1',parts:[part,{...structuredClone(part),id:'p-9002',occurrence:'9002',volume_m3:null}],skipped:0,split:true,include_hidden:false};
  let exportOK=false;
  window.sketchup.cj_request=(id,action,payload)=>{if(action==='selection')setTimeout(()=>CJSketchUp.receive(id,{ok:true,data:packet}),0);else if(action==='save'){const data=JSON.parse(payload);exportOK=atob(data.base64).startsWith('PK');setTimeout(()=>CJSketchUp.receive(id,{ok:true,data:{saved:true}}),0);}else original(id,action,payload);};
  cjSelectionDialog();await cjCapture();
  assert(document.querySelectorAll('[data-cj-part]:checked').length===2,'Part selection did not render');
  assert(!document.querySelector('.cj-parts img'),'Model name injected HTML');
  $('cj-metric').value='volume';cjPrepareSelection();
  assert(modelSpecDraft.items.length===2,'Intake did not open');
  assert(modelSpecDraft.useCard===false,'Intake changed the order title or quantity');
  assert(modelSpecDraft.items.every(x=>x.config.unit==='м³'&&x.config.driver==='volume'),'Selected metric was lost');
  const result=ModelSpecCore.apply(blank(),modelSpecDraft.spec,modelSpecDraft.productId,modelSpecDraft.items,(_id,kind)=>({...lineFrom(),kind}));
  DomainSchema.calculation(result.state);
  assert(result.state.lines[0].qty===.006&&result.state.lines[1].qty===null,'Known/unknown volumes changed');
  assert(result.state.lines.every(l=>l.price===null),'Price was invented');
  let duplicateBlocked=false;try{ModelSpecCore.apply(result.state,modelSpecDraft.spec,modelSpecDraft.productId,modelSpecDraft.items,(_id,kind)=>({...lineFrom(),kind}));}catch{duplicateBlocked=true;}
  assert(duplicateBlocked,'Repeat import was not blocked');
  const bytes=InternalReport.xlsx(InternalReport.model(result.state,CostEngine.calculate(result.state)));
  await download('synthetic-check.xlsx',bytes,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  assert(exportOK,'Binary export was corrupted');
  const plywood=CATALOG.find(c=>c.kind==='material'&&!c.needsReview&&/Фанера березовая/i.test(c.name)&&c.unit==='лист');
  assert(plywood,'Catalog fixture not found');
  packet.parts[0].labels=[{source:'definition',text:plywood.name}];
  cjSelectionDialog();await cjCapture();
  assert($('cj-material-0').value===plywood.id,'Exact component material was not suggested');
  $('cj-metric').value='surface';cjPrepareSelection();
  const matched=modelSpecDraft.items[0];
  assert(matched.config.catalogId===plywood.id&&matched.config.unit==='лист','Catalog material or unit lost');
  assert(matched.config.driver==='surface_area','Chosen geometry metric lost');
  assert(ModelSpecCore.amount(modelSpecDraft.spec,matched.row,matched.config).value===null,'Area was silently converted to sheets');
  assert(modelSpecDraft.spec.parts[0].attributes.some(a=>a.key==='Предлагаемый материал из справочника'&&a.status==='inferred'),'Material inference provenance missing');
  cjSelectionDialog();await cjCapture();$('cj-material-0').value='';cjMaterialChanged(0);cjPrepareSelection();
  assert(modelSpecDraft.items[0].config.catalogId==='','Cleared material was reapplied');
  assert(before===JSON.stringify(state)&&stored===localStorage.getItem('izdelie-state'),'UI test changed the working draft');
  sketchup.cj_probe(JSON.stringify({selectionPreview:true,escapedNames:true,intakeMapping:true,knownUnknownVolume:true,pricesUnknown:true,duplicateBlocked:true,binaryExport:true,materialExactSuggestion:true,materialUnitPreserved:true,noAreaToSheetsConversion:true,materialProvenance:true,clearedChoicePreserved:true,draftUnchanged:true}));
 }catch(e){sketchup.cj_probe(JSON.stringify({error:e.message,stack:e.stack}));}
 finally{window.sketchup.cj_request=original;modelSpecDraft=null;$('modal').close();page=0;render();}
})();
