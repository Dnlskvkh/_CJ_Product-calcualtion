function internalReportModel(){const snapshot=structuredClone(state),result=typeof CalculationArchive!=='undefined'?CalculationArchive.result(snapshot):CostEngine.calculate(snapshot);return InternalReport.model(snapshot,result);}
function exportInternalXLSX(){try{const m=internalReportModel(),data=InternalReport.xlsx(m),name=(state.code||state.name||'izdelie').replace(/[^a-zа-яё0-9_-]/gi,'_');download('Внутренний_расчёт_'+name+'_'+state.qty+'шт.xlsx',data,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');toast('Внутренний расчёт выгружен в Excel');}catch(e){toast('Не удалось выгрузить Excel: '+e.message);}}
let internalReportPreviewModel=null;
function previewInternalPDF(){try{const m=internalReportModel();internalReportPreviewModel=m;modal('Внутренний расчёт для руководства',`<p class="small">В отчёте есть себестоимость, внутренние ставки и замечания. Для PDF нажмите «Печать / сохранить PDF» и выберите «Сохранить как PDF».</p><label style="display:flex;align-items:center;gap:8px;margin-top:12px"><input id="internalReportWarnings" type="checkbox" checked onchange="updateInternalReportPreview()">Показывать замечания в отчёте</label><p class="small">Статус расчёта и исходные допущения сохраняются при любом выборе.</p><div class="mini-actions"><button class="primary" onclick="printInternalReport()">Печать / сохранить PDF</button><button onclick="exportInternalXLSX()">Скачать Excel</button></div><iframe id="internalReportPreview" title="Внутренний отчёт" style="width:100%;height:65vh;border:1px solid #dfe4dc;margin-top:15px"></iframe>`);updateInternalReportPreview();}catch(e){toast('Не удалось подготовить отчёт: '+e.message);}}
function updateInternalReportPreview(){internalReportPrintJob=null;const frame=$('internalReportPreview');if(frame&&internalReportPreviewModel)frame.srcdoc=InternalReport.html(internalReportPreviewModel,{includeWarnings:$('internalReportWarnings')?.checked!==false});}
let internalReportPrintJob=null;
async function printInternalReport(){
 const frame=$('internalReportPreview'),doc=frame?.contentDocument;
 if(internalReportPrintJob?.frame===frame&&internalReportPrintJob.doc===doc)return;
 if(!doc?.body?.textContent||doc.readyState!=='complete'){toast('Дождитесь загрузки предпросмотра');return;}
 const job={frame,doc};internalReportPrintJob=job;let timeout;
 try{
  if(!doc.fonts)throw Error('Браузер не поддерживает загрузку шрифтов отчёта');
  toast('Подготовка шрифтов и изображений для PDF…');
  const ready=async()=>{
   const faces=await Promise.all(['400 11pt "Medeo Report"','600 11pt "Medeo Report"','700 11pt "Medeo Report"'].map(font=>doc.fonts.load(font)));
   if(faces.some(list=>!list.length))throw Error('Шрифт Medeo не загрузился. Проверьте подключение или автономную копию');
   await doc.fonts.ready;
   await Promise.all(Array.from(doc.images,img=>img.decode()));
  };
  await Promise.race([ready(),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('Подготовка PDF заняла слишком много времени. Повторите печать')),15000);})]);
  if(internalReportPrintJob!==job||frame.contentDocument!==doc||!frame.isConnected)throw Error('Предпросмотр изменился. Откройте отчёт заново');
  frame.contentWindow.focus();
  // Guard asset preparation only: native print may keep this call suspended.
  clearTimeout(timeout);internalReportPrintJob=null;
  frame.contentWindow.print();
 }catch(e){toast('Не удалось подготовить PDF: '+e.message);}finally{clearTimeout(timeout);if(internalReportPrintJob===job)internalReportPrintJob=null;}
}
