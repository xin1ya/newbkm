import sys,json,re,numpy as np,subprocess
sys.path.insert(0,'/home/user'); from vsplit import load,gaps
FF='/home/user/bin/ffmpeg'
def weight(t):
    c=len(re.findall(r'[\u4e00-\u9fffA-Za-z0-9]',t)); p=len(re.findall(r'[，、；：]',t)); e=len(re.findall(r'……|——',t))
    return c*1.0+p*1.5+e*2.5+1.0
def align(path,lines):
    x,sr=load(path); g,T=gaps(x,sr,th=0.01)
    # 去掉首尾静音
    st=g[0][1] if g and g[0][0]<0.02 else 0; en=g[-1][0] if g and g[-1][1]>T-0.05 else T
    cand=[q for q in g if q[0]>st+0.1 and q[1]<en-0.1 and q[1]-q[0]>=0.18]
    w=np.array([weight(l) for l in lines]); N=len(lines); M=len(cand)
    if M<N-1: raise SystemExit(f'not enough gaps {M} < {N-1}')
    speech=en-st-sum(q[1]-q[0] for q in cand)*0.0
    cum=np.concatenate([[0],np.cumsum(w)])/w.sum()
    mid=[(q[0]+q[1])/2 for q in cand]; gl=[q[1]-q[0] for q in cand]
    INF=1e18
    rate=(en-st)/w.sum()
    pts=[st]+mid+[en]; G=[0]+gl+[0]; K=len(pts)
    def sc(k,i,j):
        d=pts[j]-pts[i]; e=w[k]*rate
        if d<=0.15: return INF
        return 6*np.log(d/e)**2 - 3.0*G[j]
    D=np.full((N,K),INF); P=np.zeros((N,K),int)
    for j in range(1,K): D[0][j]=sc(0,0,j)
    for k in range(1,N):
        for j in range(k+1,K):
            if k==N-1 and j!=K-1: continue
            best=INF;bi=-1
            for i in range(k,j):
                if D[k-1][i]>=INF: continue
                c=D[k-1][i]+sc(k,i,j)
                if c<best: best=c;bi=i
            D[k][j]=best;P[k][j]=bi
    j=K-1;idx=[]
    for k in range(N-1,0,-1): j=P[k][j]; idx.append(j)
    idx=idx[::-1]
    cuts=[cand[i-1] for i in idx]
    bounds=[st]+[ (c[0]+c[1])/2 for c in cuts]+[en]
    segs=[(bounds[i],bounds[i+1]) for i in range(N)]
    exp=w/w.sum()*(en-st)
    return x,sr,segs,exp
if __name__=='__main__':
    L=json.load(open('/home/user/voice_lines.json'))
    for v in sys.argv[1:]:
        lines=[l for l in L if l['voice']==v and not l.get('skip')]
        x,sr,segs,exp=align(f'/home/user/voice_raw/{v}.wav',[l['speak'] for l in lines])
        bad=0
        for l,(a,b),e in zip(lines,segs,exp):
            r=(b-a)/e
            if r<0.6 or r>1.6: bad+=1; print('  ?',v,round(b-a,2),round(e,2),l['speak'][:20])
        print(v,len(lines),'bad',bad)
