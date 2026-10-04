import sys,json,os,subprocess,numpy as np
sys.path.insert(0,'/home/user'); import valign,vdp
L=json.load(open('/home/user/voice_lines.json'))
out='/home/user/voice_out'; os.makedirs(out,exist_ok=True)
rep=json.load(open('/home/user/voice_report.json')) if os.path.exists('/home/user/voice_report.json') else {}
for v in sys.argv[1:]:
    lines=[l for l in L if l.get('batch',l['voice'])==v and not l.get('skip')]
    texts=[l['speak'] for l in lines]
    x,sr,sa,cov=valign.align(f'/home/user/voice_raw/{v}.wav',texts)
    _,_,sd,_=vdp.align(f'/home/user/voice_raw/{v}.wav',texts)
    avg=sum(cov)/len(cov)
    # 逐边界：两侧句子都有识别锚点时用 ASR 边界，否则用时长 DP 边界
    b=[sa[0][0]]
    for i in range(len(lines)-1):
        use_asr = avg>0.5 and cov[i]>=0.3 and cov[i+1]>=0.3
        b.append(sa[i][1] if use_asr else sd[i][1])
    b.append(sa[-1][1])
    for i in range(1,len(b)):
        if b[i]<=b[i-1]+0.2: b[i]=b[i-1]+0.2
    agree=sum(1 for i in range(len(lines)-1) if abs(sa[i][1]-sd[i][1])<0.25)
    print(v,'n',len(lines),'asr-cov',round(avg,2),'asr/dp agree',agree,'/',len(lines)-1)
    for i,l in enumerate(lines):
        a,e=b[i],b[i+1]
        i0=max(0,int((a-0.03)*sr)); i1=min(len(x),int((e+0.05)*sr)); seg=x[i0:i1].copy()
        f=int(0.012*sr); seg[:f]*=np.linspace(0,1,f); seg[-f:]*=np.linspace(1,0,f)
        act=seg[np.abs(seg)>0.01]; rms=np.sqrt(np.mean(act**2)) if len(act) else 0.1
        seg*=min(0.1/rms,0.9/max(1e-3,np.abs(seg).max()))
        subprocess.run([os.path.expanduser('~/bin/ffmpeg'),'-v','error','-y','-f','f32le','-ar',str(sr),'-ac','1','-i','-','-c:a','libmp3lame','-b:a','56k',f"{out}/{l['id']}.mp3"],input=seg.astype(np.float32).tobytes(),check=True)
        rep[l['id']]={'voice':l['voice'],'speaker':l['speaker'],'text':l['text'],'dur':round(e-a,2),'cov':round(cov[i],2)}
json.dump(rep,open('/home/user/voice_report.json','w'),ensure_ascii=False,indent=0)
