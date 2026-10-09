// Inverse camera sampling. Shared by video and the forward-solved surface mesh.
export const faceWarpGLSL=`
vec2 metric(vec2 p){return p*vec2(aspect,1.);}
vec2 bulge(vec2 uv,vec2 center,float radius,float amount){vec2 d=uv-center;float f=exp(-dot(metric(d),metric(d))/(radius*radius));return d*f*amount;}
vec2 faceSample(vec2 p){
 if(abs(impact)<.0001)return p;
 vec2 uv=p;float radius=max(.04,face.w);
 uv-=bulge(p,anchors[1],radius*.47,impact*.64);
 uv-=bulge(p,anchors[2],radius*.47,impact*.50);
 float nose=exp(-dot(metric(p-anchors[0]),metric(p-anchors[0]))/pow(radius*.36,2.));
 uv.x-=direction*radius*.23*impact*nose;
 vec2 mouth=(anchors[3]+anchors[4])*.5,d=metric(p-mouth);
 float lips=exp(-dot(d*vec2(.65,1.7),d*vec2(.65,1.7))/pow(radius*.38,2.));
 uv.x-=(p.x-mouth.x)*impact*.65*lips;uv.y+=impact*radius*.08*lips;
 float mask=exp(-dot(metric(p-face.xy),metric(p-face.xy))/pow(radius*.85,2.));
 uv.x-=direction*impact*.022*mask*(p.y-face.y)/radius;
 return uv;
}`;
