import sys,json,subprocess,numpy as np
def load(p):
    raw=subprocess.run(['/home/user/bin/ffmpeg','-v','error','-i',p,'-ac','1','-ar','24000','-f','s16le','-'],capture_output=True).stdout
    return np.frombuffer(raw,np.int16).astype(np.float32)/32768,24000
def gaps(x,sr,win=0.01,th=0.012):
    n=int(sr*win); e=np.sqrt(np.convolve(x**2,np.ones(n)/n,'same'))[::n]
    sil=e<th; out=[]; i=0
    while i<len(sil):
        if sil[i]:
            j=i
            while j<len(sil) and sil[j]: j+=1
            out.append((i*win,j*win)); i=j
        else: i+=1
    return out,len(sil)*win
def split(p,N):
    x,sr=load(p); g,T=gaps(x,sr)
    inner=[q for q in g if q[0]>0.05 and q[1]<T-0.05]
    big=sorted(inner,key=lambda q:q[1]-q[0],reverse=True)[:N-1]
    big.sort()
    durs=sorted([round(q[1]-q[0],2) for q in inner],reverse=True)
    return big,durs,T,x,sr
if __name__=='__main__':
    p,N=sys.argv[1],int(sys.argv[2])
    big,d,T,_,_=split(p,N)
    print('T',T,'top gaps',d[:N+3]); print('cut gap min',min(b[1]-b[0] for b in big))
