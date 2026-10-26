(() => {
  const $ = (id) => document.getElementById(id);
  const fileInput = $('fileInput'), cameraInput = $('cameraInput'), fileList = $('fileList');
  const resultText = $('resultText'), readBtn = $('readBtn'), downloadBtn = $('downloadBtn');
  const files = [];
  let toastTimer;
  const toast = (message) => { const node=$('toast'); node.textContent=message; node.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>node.classList.remove('show'),2800); };
  const sizeLabel = (bytes) => bytes < 1024*1024 ? `${Math.max(1,Math.round(bytes/1024))} KB` : `${(bytes/1024/1024).toFixed(1)} MB`;
  const isPdf = (file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

  function addFiles(incoming) {
    let added=0;
    [...incoming].forEach(file => {
      if (!file.type.startsWith('image/') && !isPdf(file)) { toast(`${file.name}: केवल फोटो और PDF फाइलें समर्थित हैं`); return; }
      if (file.size > 20*1024*1024) { toast(`${file.name}: फाइल 20 MB से छोटी रखें`); return; }
      if (files.some(x=>x.file.name===file.name && x.file.size===file.size)) return;
      files.push({file, id:crypto.randomUUID()}); added++;
    });
    if (added) { renderFiles(); toast(`${added} फाइल${added>1?'ें':''} जोड़ दी गई${added>1?'ं':''}`); }
  }
  function renderFiles() {
    fileList.replaceChildren();
    files.forEach((entry,index) => {
      const row=document.createElement('div'); row.className='file-item';
      const order=document.createElement('span'); order.className='file-order'; order.textContent=String(index+1).padStart(2,'0'); order.title=`Word में क्रम ${index+1}`; row.append(order);
      if (entry.file.type.startsWith('image/')) { const image=document.createElement('img'); image.className='file-thumb'; image.src=URL.createObjectURL(entry.file); image.alt=''; row.append(image); }
      else { const icon=document.createElement('span'); icon.className='file-icon'; icon.textContent='PDF'; row.append(icon); }
      const name=document.createElement('span'); name.className='file-name'; name.textContent=entry.file.name; name.title=entry.file.name;
      const size=document.createElement('span'); size.className='file-size'; size.textContent=sizeLabel(entry.file.size);
      const moveUp=document.createElement('button'); moveUp.className='move-file'; moveUp.type='button'; moveUp.setAttribute('aria-label','सूची में ऊपर करें'); moveUp.title='Word क्रम में ऊपर करें'; moveUp.textContent='↑'; moveUp.disabled=index===0;
      moveUp.onclick=()=>{[files[index-1],files[index]]=[files[index],files[index-1]];renderFiles();};
      const moveDown=document.createElement('button'); moveDown.className='move-file'; moveDown.type='button'; moveDown.setAttribute('aria-label','सूची में नीचे करें'); moveDown.title='Word क्रम में नीचे करें'; moveDown.textContent='↓'; moveDown.disabled=index===files.length-1;
      moveDown.onclick=()=>{[files[index],files[index+1]]=[files[index+1],files[index]];renderFiles();};
      const remove=document.createElement('button'); remove.className='remove-file'; remove.type='button'; remove.setAttribute('aria-label','फाइल हटाएँ'); remove.textContent='×'; remove.onclick=()=>{files.splice(files.indexOf(entry),1);renderFiles();};
      row.append(name,size,moveUp,moveDown,remove); fileList.append(row);
    });
    readBtn.disabled=files.length===0;
  }
  fileInput.addEventListener('change', e=>{addFiles(e.target.files);e.target.value='';});
  cameraInput.addEventListener('change', e=>{addFiles(e.target.files);e.target.value='';});
  $('cameraBtn').addEventListener('click',()=>cameraInput.click());
  $('dropzone').addEventListener('click',e=>{if(!e.target.closest('label')) fileInput.click();});
  for (const event of ['dragenter','dragover']) $('dropzone').addEventListener(event,e=>{e.preventDefault();$('dropzone').classList.add('dragover');});
  for (const event of ['dragleave','drop']) $('dropzone').addEventListener(event,e=>{e.preventDefault();$('dropzone').classList.remove('dragover');});
  $('dropzone').addEventListener('drop',e=>addFiles(e.dataTransfer.files));

  async function imageForPage(file, pageNumber) {
    if (!isPdf(file)) return file;
    if (!window.pdfjsLib) throw new Error('PDF लाइब्रेरी लोड नहीं हुई। इंटरनेट कनेक्शन जाँचें।');
    pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const pdf=await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;
    const page=await pdf.getPage(pageNumber); const viewport=page.getViewport({scale:2.4});
    const canvas=document.createElement('canvas'); canvas.width=viewport.width; canvas.height=viewport.height;
    await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
    return await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  }
  async function makeOcrCandidates(source) {
    const bitmap=await createImageBitmap(source);
    const longest=Math.max(bitmap.width,bitmap.height);
    const scale=Math.min(2.2,2600/longest);
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(bitmap.width*scale));
    canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    const context=canvas.getContext('2d',{willReadFrequently:true});
    context.imageSmoothingEnabled=true; context.imageSmoothingQuality='high';
    context.drawImage(bitmap,0,0,canvas.width,canvas.height);
    bitmap.close();
    const original=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));

    // A grayscale, contrast-stretched candidate helps with dim phone photos while
    // retaining the original candidate for colored ink, thin strokes, and stamps.
    const pixels=context.getImageData(0,0,canvas.width,canvas.height);
    const histogram=new Uint32Array(256); const luminance=new Uint8Array(canvas.width*canvas.height);
    for(let i=0,p=0;i<pixels.data.length;i+=4,p++) {
      const gray=Math.round(.299*pixels.data[i]+.587*pixels.data[i+1]+.114*pixels.data[i+2]);
      luminance[p]=gray; histogram[gray]++;
    }
    const total=luminance.length, lowTarget=Math.floor(total*.01), highTarget=Math.floor(total*.99);
    let cumulative=0,low=0,high=255;
    for(let i=0;i<256;i++){cumulative+=histogram[i];if(cumulative>=lowTarget){low=i;break;}}
    cumulative=0;for(let i=0;i<256;i++){cumulative+=histogram[i];if(cumulative>=highTarget){high=i;break;}}
    const range=Math.max(40,high-low);
    for(let p=0,i=0;p<luminance.length;p++,i+=4){
      const value=Math.max(0,Math.min(255,Math.round((luminance[p]-low)*255/range)));
      pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=value;
    }
    context.putImageData(pixels,0,0);
    const enhanced=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));

    // A locally thresholded copy can make blue-pen strokes stand out from a
    // shadowed page. Otsu's threshold is computed from the enhanced luminance.
    const enhancedPixels=context.getImageData(0,0,canvas.width,canvas.height);
    const hist=new Uint32Array(256); let sum=0;
    for(let i=0;i<enhancedPixels.data.length;i+=4){const y=enhancedPixels.data[i];hist[y]++;sum+=y;}
    const count=canvas.width*canvas.height; let bgSum=0,bgCount=0,bestVariance=-1,threshold=160;
    for(let t=0;t<256;t++){
      bgCount+=hist[t]; if(!bgCount)continue;
      const fgCount=count-bgCount; if(!fgCount)break;
      bgSum+=t*hist[t];
      const meanBg=bgSum/bgCount,meanFg=(sum-bgSum)/fgCount;
      const variance=bgCount*fgCount*(meanBg-meanFg)*(meanBg-meanFg);
      if(variance>bestVariance){bestVariance=variance;threshold=t;}
    }
    for(let i=0;i<enhancedPixels.data.length;i+=4){
      const value=enhancedPixels.data[i]>threshold?255:0;
      enhancedPixels.data[i]=enhancedPixels.data[i+1]=enhancedPixels.data[i+2]=value;
    }
    context.putImageData(enhancedPixels,0,0);
    const thresholded=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));

    // Adaptive thresholding compensates for shadows or uneven lighting across
    // the page by comparing each pixel with its local neighborhood.
    const width=canvas.width,height=canvas.height,stride=width+1;
    const integral=new Uint32Array((width+1)*(height+1));
    for(let y=1;y<=height;y++){
      let rowSum=0; const pixelRow=(y-1)*width, integralRow=y*stride, above=(y-1)*stride;
      for(let x=1;x<=width;x++){
        rowSum+=enhancedPixels.data[(pixelRow+x-1)*4];
        integral[integralRow+x]=integral[above+x]+rowSum;
      }
    }
    const adaptivePixels=context.createImageData(width,height),radius=25,offset=12;
    for(let y=0;y<height;y++){
      const y0=Math.max(0,y-radius),y1=Math.min(height,y+radius+1),top=y0*stride,bottom=y1*stride;
      for(let x=0;x<width;x++){
        const x0=Math.max(0,x-radius),x1=Math.min(width,x+radius+1);
        const area=(x1-x0)*(y1-y0);
        const localMean=(integral[bottom+x1]-integral[top+x1]-integral[bottom+x0]+integral[top+x0])/area;
        const source=enhancedPixels.data[(y*width+x)*4];
        const value=source<localMean-offset?0:255,index=(y*width+x)*4;
        adaptivePixels.data[index]=adaptivePixels.data[index+1]=adaptivePixels.data[index+2]=value;
        adaptivePixels.data[index+3]=255;
      }
    }
    context.putImageData(adaptivePixels,0,0);
    const shadowCorrected=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    return [original,enhanced,thresholded,shadowCorrected].filter(Boolean);
  }
  async function readFiles() {
    if (!files.length || !window.Tesseract) { toast('OCR सेवा लोड नहीं हुई। इंटरनेट कनेक्शन जाँचें।'); return; }
    readBtn.disabled=true; $('progressWrap').hidden=false;
    const blocks=[]; let pageCount=0; let worker=null;
    try {
      worker=await Tesseract.createWorker('hin+eng',1,{logger:m=>{
        const pct=Math.round((m.progress||0)*100); $('progressPct').textContent=`${pct}%`; $('progressBar').style.width=`${pct}%`;
        if(m.status) $('progressText').textContent=m.status==='recognizing text'?'टेक्स्ट पढ़ा जा रहा है…':m.status==='loading language model'?'भाषा की पहचान तैयार हो रही है…':'पहचान जारी है…';
      }});
      await worker.setParameters({tessedit_pageseg_mode:'3',preserve_interword_spaces:'1'});
      for (let i=0;i<files.length;i++) {
        const {file}=files[i]; const pages=isPdf(file)?(await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise).numPages:1;
        for(let p=1;p<=pages;p++) {
          pageCount++; $('progressText').textContent=`${file.name} · ${isPdf(file)?`पेज ${p}/${pages}`:'फोटो पढ़ रहे हैं'}`;
          const img=await imageForPage(file,p);
          $('progressText').textContent=`${file.name} · फोटो साफ़ की जा रही है…`;
          const candidates=await makeOcrCandidates(img);
          $('progressText').textContent=`${file.name} · साफ़ फोटो से टेक्स्ट पढ़ रहे हैं…`;
          let best=null;
          for(const candidate of candidates) {
            const {data}=await worker.recognize(candidate);
            // Confidence is the main signal; a small length tie-break avoids
            // choosing an almost-empty result when two variants score alike.
            const score=(data.confidence||0)+Math.min(data.text.trim().length/1000,1);
            if(!best||score>best.score) best={score,data};
          }
          const text=best?.data.text.trim(); if(text) blocks.push(text);
        }
      }
      resultText.value=blocks.join('\n\n');
      $('emptyOverlay').hidden=true; downloadBtn.disabled=!resultText.value.trim();
      $('progressText').textContent='पहचान पूरी हुई'; $('progressPct').textContent='100%'; $('progressBar').style.width='100%';
      toast(blocks.length?`${pageCount} पेज से टेक्स्ट तैयार है — कृपया जाँच लें`:'इस फाइल में टेक्स्ट नहीं मिला');
    } catch(error) { console.error(error); toast(error.message||'टेक्स्ट पहचानने में समस्या हुई'); }
    finally { if(worker) await worker.terminate(); readBtn.disabled=files.length===0; }
  }
  readBtn.addEventListener('click',readFiles);
  resultText.addEventListener('input',()=>{ $('emptyOverlay').hidden=!!resultText.value; downloadBtn.disabled=!resultText.value.trim(); });

  // KrutiDev 010 is a legacy font encoding: Devanagari needs remapping before it is assigned that font.
  // Common ligatures and pre-base signs are handled first to preserve their display order in Word.
  function toKrutiDev(input) {
    const rules=[
      ['क्ष','क्ष'],['त्र','त्र'],['ज्ञ','ज्ञ'],['श्र','श्र'],['र्द्ध','र्द्ध'],['्र','z'],
      ['मैं','eSa'],['है','gS'],['हैं','gSa'],
      ['अ','v'],['आ','vk'],['इ','b'],['ई','bZ'],['उ','m'],['ऊ','Å'],['ए',','],['ऐ',',s'],['ओ','vks'],['औ','vkS'],
      ['क','d'],['ख','[k'],['ग','x'],['घ','?k'],['ङ','³'],['च','p'],['छ','N'],['ज','t'],['झ','>'],['ञ','¥'],
      ['ट','V'],['ठ','B'],['ड','M'],['ढ','<'],['ण','.'],['त','r'],['थ','Fk'],['द','n'],['ध','/'],['न','u'],
      ['प','i'],['फ','Q'],['ब','c'],['भ','Hk'],['म','e'],['य',';'],['र','j'],['ल','y'],['व','o'],['श','\'k'],['ष','"k'],['स','l'],['ह','g'],
      ['ा','k'],['ि','f'],['ी','h'],['ु','q'],['ू','w'],['े','s'],['ै','S'],['ो','ks'],['ौ','kS'],['ं','a'],['ः','%'],['ँ','¡'],['्','~'],['।','A'],
    ];
    const consonantCluster='(?:[क-ह](?:्[क-ह])*)';
    let out=input
      .replace(new RegExp(`र्((${consonantCluster}))`,'g'),'$1§')
      .replace(new RegExp(`((${consonantCluster}))ि`,'g'),'ि$1');
    // Build output by walking grapheme clusters, retaining all Latin text and punctuation as entered.
    const map=new Map(rules.filter(([k])=>[...k].length===1));
    const multi=rules.filter(([k])=>[...k].length>1 && !k.includes('('));
    for(const [from,to] of multi) out=out.split(from).join(to);
    out=[...out].map(ch=>map.get(ch)||ch).join('');
    return out.replaceAll('§','Z');
  }
  function splitHindiRuns(text) {
    const parts=text.match(/[\u0900-\u097F]+|[^\u0900-\u097F]+/g)||[];
    return parts.map(part=>new docx.TextRun({text:/[\u0900-\u097F]/.test(part)?toKrutiDev(part):part,font:/[\u0900-\u097F]/.test(part)?'Kruti Dev 010':'Arial',size:24}));
  }
  downloadBtn.addEventListener('click',async()=>{
    if(!resultText.value.trim())return;
    if(!window.docx){toast('Word बनाने की सेवा लोड नहीं हुई। इंटरनेट कनेक्शन जाँचें।');return;}
    downloadBtn.disabled=true;
    try {
      const {Document,Packer,Paragraph,TextRun}=docx;
      const paragraphs=resultText.value.split(/\r?\n/).map(line=>new Paragraph({children:line?splitHindiRuns(line):[new TextRun('')],spacing:{after:120,line:360}}));
      const docxDocument=new Document({sections:[{properties:{page:{margin:{top:850,right:950,bottom:850,left:950}}},children:paragraphs}]});
      const blob=await Packer.toBlob(docxDocument); const link=window.document.createElement('a'); link.href=URL.createObjectURL(blob); link.download='yashoeditor-document.docx'; link.click(); setTimeout(()=>URL.revokeObjectURL(link.href),1500); toast('Word फाइल डाउनलोड हो गई');
    } catch(error) { console.error(error);toast('Word फाइल बनाने में समस्या हुई'); }
    finally {downloadBtn.disabled=!resultText.value.trim();}
  });
})();

