import sys,json,re,difflib,numpy as np
sys.path.insert(0,'/home/user')
from vsplit import load,gaps
from vosk import Model,KaldiRecognizer,SetLogLevel
from pypinyin import lazy_pinyin
SetLogLevel(-1)
_M=None
def model():
    global _M
    if _M is None: _M=Model('/home/user/.cache/vosk-model-small-cn-0.22')
    return _M
def words(x,sr):
    y=np.interp(np.arange(0,len(x),sr/16000),np.arange(len(x)),x)
    r=KaldiRecognizer(model(),16000); r.SetWords(True)
    pcm=(np.clip(y,-1,1)*32767).astype(np.int16).tobytes(); res=[]
    for i in range(0,len(pcm),32000):
        if r.AcceptWaveform(pcm[i:i+32000]): res+=json.loads(r.Result()).get('result',[])
    res+=json.loads(r.FinalResult()).get('result',[])
    chars=[]
    for w in res:
        t=w['word']; n=len(t)
        for k,c in enumerate(t): chars.append((c,w['start']+(w['end']-w['start'])*k/n,w['start']+(w['end']-w['start'])*(k+1)/n))
    return chars
def han(t): return re.sub(r'[^\u4e00-\u9fff0-9]','',t)
def align(path,lines):
    x,sr=load(path); g,T=gaps(x,sr,th=0.01)
    ch=words(x,sr)
    hyp=[lazy_pinyin(c[0])[0] for c in ch]
    ref=[];own=[]
    for i,l in enumerate(lines):
        for c in han(l): ref.append(lazy_pinyin(c)[0]); own.append(i)
    sm=difflib.SequenceMatcher(None,ref,hyp,autojunk=False)
    # 每个 ref 字 → 时间（匹配块内）
    tmap={}
    for a,b,n in sm.get_matching_blocks():
        for k in range(n): tmap[a+k]=(ch[b+k][1],ch[b+k][2])
    N=len(lines); first=[None]*N; last=[None]*N
    for ri,(i) in enumerate(own):
        if ri in tmap:
            s,e=tmap[ri]
            if first[i] is None: first[i]=s
            last[i]=e
    st=g[0][1] if g and g[0][0]<0.02 else 0; en=g[-1][0] if g and g[-1][1]>T-0.05 else T
    cand=[q for q in g if q[0]>st+0.05 and q[1]<en-0.05 and q[1]-q[0]>=0.12]
    bounds=[st]
    for i in range(N-1):
        lo=last[i]; hi=next((first[j] for j in range(i+1,N) if first[j] is not None),None)
        # 在 [上一句末字, 下一句首字] 区间内选最长静音
        lo2=lo if lo is not None else bounds[-1]; hi2=hi if hi is not None else en
        inside=[q for q in cand if q[1]>lo2-0.15 and q[0]<hi2+0.15 and (q[0]+q[1])/2>bounds[-1]+0.2]
        if inside: q=max(inside,key=lambda q:q[1]-q[0]); bounds.append((q[0]+q[1])/2)
        else: bounds.append(((lo2+hi2)/2) if lo is not None and hi is not None else bounds[-1]+0.5)
    bounds.append(en)
    conf=[ (first[i] is not None) for i in range(N)]
    cover=[sum(1 for ri,o in enumerate(own) if o==i and ri in tmap)/max(1,sum(1 for o in own if o==i)) for i in range(N)]
    return x,sr,[(bounds[i],bounds[i+1]) for i in range(N)],cover
