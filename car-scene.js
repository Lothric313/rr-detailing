import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { carSceneConfig as config } from './car-config.js?v=glass-tint';

function carbonMaterial(){
 const material=new THREE.MeshPhysicalMaterial({
  color:0x141517,metalness:.62,roughness:.46,envMapIntensity:.6,
  specularIntensity:.45,clearcoat:.2,clearcoatRoughness:.38,
 });
 material.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec3 rrCarbonPoint, rrCarbonNormal;\n'+shader.vertexShader.replace(
   '#include <beginnormal_vertex>',
   '#include <beginnormal_vertex>\nrrCarbonPoint = position;\nrrCarbonNormal = objectNormal;');
  shader.fragmentShader=`
   varying vec3 rrCarbonPoint, rrCarbonNormal;
   float rrWeave(vec2 point) {
    vec2 cell = point * 64.0;
    float thread = step(1.0, mod(floor(cell.x) + floor(cell.y), 4.0));
    vec2 fibers = pow(abs(sin(fract(cell) * 3.14159)), vec2(0.6));
    float weave = mix(fibers.x, fibers.y, thread) * mix(0.66, 1.0, thread);
    float detail = 1.0 - smoothstep(0.4, 1.0, max(fwidth(cell.x), fwidth(cell.y)));
    return mix(0.65, weave, detail);
   }
  `+shader.fragmentShader.replace('#include <color_fragment>',`
   #include <color_fragment>
   vec3 weight = pow(abs(normalize(rrCarbonNormal)), vec3(6.0));
   weight /= weight.x + weight.y + weight.z;
   float weave = dot(weight, vec3(rrWeave(rrCarbonPoint.yz),
     rrWeave(rrCarbonPoint.xz), rrWeave(rrCarbonPoint.xy)));
   diffuseColor.rgb *= mix(0.45, 1.35, weave);
  `);
 };
 return material;
}

function assignSpoiler(mesh,carbon){
 const geometry=mesh.geometry, positions=geometry.attributes.position;
 const indices=geometry.index.array;
 const trim=mesh.material.name===config.materials.trim;
 const isSpoiler=i=>positions.getZ(i)<-1.7 &&
  (positions.getY(i)>.93 || (trim&&positions.getY(i)>.65&&Math.abs(positions.getX(i))>.52));
 const body=[], wing=[];
 // The wing shares the paint meshes. Split its triangles using the model's local coordinates.
 for(let i=0;i<indices.length;i+=3){
  const a=indices[i], b=indices[i+1], c=indices[i+2];
  const group=isSpoiler(a)&&isSpoiler(b)&&isSpoiler(c)?wing:body;
  group.push(a,b,c);
 }
 geometry.setIndex(new THREE.BufferAttribute(new indices.constructor([...body,...wing]),1));
 geometry.clearGroups();
 geometry.addGroup(0,body.length,0);
 geometry.addGroup(body.length,wing.length,1);
 mesh.material=[mesh.material,carbon];
}

const layer=document.querySelector('#scene-layer'), host=document.querySelector('#scene-canvas'), loading=document.querySelector('#scene-loading');
const journey=document.querySelector('#scene-journey'), reduced=matchMedia('(prefers-reduced-motion: reduce)'), mobile=window.rrMobile;
const footer=document.querySelector('.site-footer');
const footerCar=footer.querySelector('.footer-car');
const footerHost=footer.querySelector('.footer-car-canvas');
let started=false;
function fallback(message){loading.textContent=message;window.finishCarLoading?.()}
function start(){
 if(started)return;started=true;
 let renderer;try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});if(!renderer.getContext())throw Error('WebGL unavailable')}catch(error){console.warn('Car scene unavailable:',error);fallback('3D-просмотр недоступен на этом устройстве');return}
 host.append(renderer.domElement);renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
 const scene=new THREE.Scene(), camera=new THREE.OrthographicCamera(-5,5,3.75,-3.75,.1,100);camera.position.set(0,5,30);camera.lookAt(0,0,0);
 const footerCamera=new THREE.OrthographicCamera(-5,5,2,-2,.1,100);
 footerCamera.position.set(0,2.2,30);
 footerCamera.lookAt(0,0,0);
 const pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(new RoomEnvironment(),.04).texture;pmrem.dispose();
 scene.add(new THREE.HemisphereLight(0xe4edff,0x172035,2));const key=new THREE.DirectionalLight(0xffffff,3);key.position.set(-3,8,6);scene.add(key);const blue=new THREE.DirectionalLight(config.color,4);blue.position.set(5,3,-5);scene.add(blue);
 const rig=new THREE.Group();scene.add(rig);
 // Soft procedural contact shadow, no per-frame shadow map on weaker devices.
 const shadowCanvas=document.createElement('canvas');shadowCanvas.width=128;shadowCanvas.height=128;const ctx=shadowCanvas.getContext('2d'),g=ctx.createRadialGradient(64,64,8,64,64,64);g.addColorStop(0,'rgba(0,0,0,.5)');g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);const shadow=new THREE.Mesh(new THREE.PlaneGeometry(5.5,3.6),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false,opacity:.55}));shadow.rotation.x=-Math.PI/2;shadow.position.y=-1;rig.add(shadow);
 const loader=new GLTFLoader();
 let car, carHeight;
 const wheels=[];
 let visible=true, footerVisible=false, raf=0;
 let renderHost, renderWidth, renderHeight, renderRatio, lastFooterProgress;
 const drive=config.drive, viewHeight=7.5;
 const position=new THREE.Vector3();
 const previewControls=[...document.querySelectorAll('#services [data-car-preview]')];
 let paint, glass;
 let sceneWidth, exitLength, heroScale, serviceScale, approach, approachLength;
 function resize(){
  const width=layer.clientWidth, height=layer.clientHeight;
  if(!width||!height)return;
  sceneWidth=viewHeight*width/height;
  camera.left=-sceneWidth/2;camera.right=sceneWidth/2;
  camera.top=viewHeight/2;camera.bottom=-viewHeight/2;
  camera.updateProjectionMatrix();
  exitLength=-sceneWidth*drive.exitX;
  heroScale=Math.min(sceneWidth*drive.heroWidth/config.modelSize,drive.heroMaxScale);
  serviceScale=Math.min(1,sceneWidth/9.4);
  approach=new THREE.CatmullRomCurve3(drive.approach.map(([x,z])=>
    new THREE.Vector3(x*sceneWidth,0,z*sceneWidth)));
  approachLength=approach.getLength();

  lastFooterProgress=undefined;
  requestRender();
 }
 const serviceSection=document.querySelector('#services');
 const serviceContent=serviceSection.querySelector('.services-content');
 const hero=document.querySelector('#top');
 const heroTitle=hero.querySelector('h1');
 const heroActions=hero.querySelector('.hero-actions');
 const layoutObserver=new ResizeObserver(()=>requestRender());
 layoutObserver.observe(serviceSection);
 layoutObserver.observe(heroTitle);
 layoutObserver.observe(heroActions);
 window.addEventListener('resize',resize);resize();
 function renderCar(preview){
  if(paint){
   paint.material.roughness=preview?paint.previewRoughness:paint.originalRoughness;
   paint.material.envMapIntensity=preview?paint.previewReflection:1;
  }
  if(glass)glass.mesh.material=preview?glass.preview:glass.original;
  renderer.render(scene,camera);
 }
 function requestRender(){
  if(!mobile.matches&&(visible||footerVisible)&&car&&!raf)raf=requestAnimationFrame(render);
 }
 function rollWheels(distance){
  for(const {node,rest,direction,radius} of wheels){
   node.quaternion.copy(rest);
   node.rotateX(direction*distance/radius);
  }
 }
 function setRenderTarget(target,width,height,ratio){
  if(renderHost!==target){
   target.append(renderer.domElement);
   renderHost=target;
  }
  if(renderRatio!==ratio){
   renderer.setPixelRatio(ratio);
   renderRatio=ratio;
  }
  if(renderWidth!==width||renderHeight!==height){
   renderer.setSize(width,height,false);
   renderWidth=width;
   renderHeight=height;
  }
 }
 function renderFooter(){
  const rect=footer.getBoundingClientRect();
  const progress=reduced.matches?1:THREE.MathUtils.clamp((innerHeight-rect.top)/Math.max(1,rect.height),0,1);
  if(progress===lastFooterProgress&&renderHost===footerHost)return;
  const width=footerHost.clientWidth, height=footerHost.clientHeight;
  if(!width||!height)return;
  const viewHeight=Math.max(2.4,7.3*height/width);
  const viewWidth=viewHeight*width/height;
  footerCamera.left=-viewWidth/2;
  footerCamera.right=viewWidth/2;
  footerCamera.top=viewHeight/2;
  footerCamera.bottom=-viewHeight/2;
  footerCamera.updateProjectionMatrix();

  // The same car, textures, and WebGL context serve both ends of the page.
  setRenderTarget(footerHost,width,height,Math.min(devicePixelRatio||1,1.25));
  rig.visible=true;
  shadow.visible=false;
  rig.position.set(0,0,0);
  rig.rotation.y=Math.PI/2;
  rig.scale.setScalar(1);
  rollWheels(reduced.matches?0:progress*viewWidth);
  if(paint){
   paint.material.roughness=paint.originalRoughness;
   paint.material.envMapIntensity=1;
  }
  if(glass)glass.mesh.material=glass.tintedPanes;
  renderer.render(scene,footerCamera);
  footerCar.style.setProperty('--footer-car-offset',`${-100*(1-progress)}%`);
  lastFooterProgress=progress;
 }
 function render(){
  raf=0;
  if(mobile.matches||!car||!approach)return;
  if(footerVisible){
   renderFooter();
   return;
  }
  if(!visible)return;
  const height=layer.clientHeight;
  setRenderTarget(host,layer.clientWidth,height,Math.min(devicePixelRatio||1,2));
  shadow.visible=true;
  const journeyTop=journey.getBoundingClientRect().top;
  const scroll=Math.max(0,-journeyTop);
  const heroHeight=hero.offsetHeight;
  const exitAt=heroHeight*drive.exitAt;
  const enterAt=heroHeight*drive.enterAt;
  const servicesTop=serviceSection.offsetTop;
  const parkAt=servicesTop+serviceSection.offsetHeight*drive.parkAt;
  const reducedMotion=reduced.matches;
  const inHero=reducedMotion?scroll<heroHeight*.5:scroll<=exitAt;
  const returning=reducedMotion?!inHero:scroll>=enterAt;
  const progress=reducedMotion?1:THREE.MathUtils.clamp((scroll-enterAt)/(parkAt-enterAt),0,1);
  const parked=returning&&progress===1;
  serviceContent.classList.toggle('awaiting-car',!reducedMotion&&!parked);
  const parkCenter=height * .5;
  const parkAnchor=servicesTop+Math.max(0,parkCenter-height/2);
  const anchor=returning?THREE.MathUtils.lerp(servicesTop-.38*height,parkAnchor,progress):0;
  const titleRect=heroTitle.getBoundingClientRect();
  const overlap=Math.min(42,titleRect.height*.26);
  const carTop=titleRect.bottom-journeyTop-overlap;
  const availableHeight=heroActions.getBoundingClientRect().top-journeyTop-carTop-20;
  const carHeightInPixels=carHeight*height/viewHeight;
  const fittedHeroScale=Math.min(heroScale,Math.max(1,availableHeight)/carHeightInPixels);
  const heroCenter=carTop+carHeightInPixels*fittedHeroScale/2;
  const center=returning?THREE.MathUtils.lerp(height*.58,Math.min(height/2,parkCenter),progress):heroCenter;
  layer.style.transform='translateY('+anchor+'px)';
  const headingTilt=returning?THREE.MathUtils.lerp(2,5,progress):0;
  camera.position.set(0,headingTilt,30);
  camera.lookAt(0,0,0);
  let heading, distance;
  if(inHero){
   const exitDistance=reducedMotion?0:exitLength*Math.min(1,scroll/exitAt);
   heading=-Math.PI/2;
   position.set(-exitDistance,0,0);
   distance=exitDistance/fittedHeroScale;
  }else{
   approach.getPointAt(progress,position);
   heading=-Math.PI/2+.28*THREE.MathUtils.smoothstep(progress,.72,1);
   distance=reducedMotion?0:exitLength/fittedHeroScale+approachLength*progress/serviceScale;
  }
  const lift=(.5-center/height)*viewHeight;
  rig.visible=inHero||returning;
  rig.scale.setScalar(inHero?fittedHeroScale:serviceScale);
  rig.position.copy(position);
  rig.position.y+=lift;
  rig.rotation.y=heading;
  rollWheels(distance);
  renderCar(parked);
  window.finishCarLoading?.();
 }
 function setVisible(value){
  visible=value;
  if(mobile.matches||reduced.matches)serviceContent.classList.remove('awaiting-car');
  requestRender();
 }
 const visibility=new IntersectionObserver(([entry])=>setVisible(entry.isIntersecting));
 visibility.observe(journey);
 new IntersectionObserver(([entry])=>{
  footerVisible=entry.isIntersecting;
  requestRender();
 }).observe(footer);
 window.addEventListener('scroll',requestRender,{passive:true});
 reduced.addEventListener('change',requestRender);
 mobile.addEventListener('change',()=>setVisible(
  journey.getBoundingClientRect().bottom>0&&journey.getBoundingClientRect().top<innerHeight));
 function updatePreview(){
  const selected=new Set(previewControls.filter(input=>input.checked).map(input=>input.dataset.carPreview));
  if(paint){
   if(selected.has('deep-polish')){
    paint.previewRoughness=.055;
    paint.previewReflection=1.35;
   }else if(selected.has('light-polish')){
    paint.previewRoughness=.115;
    paint.previewReflection=1.18;
   }else{
    paint.previewRoughness=paint.originalRoughness;
    paint.previewReflection=1;
   }
  }
  if(glass){
   glass.preview=config.glassGroups.map(({zone})=>selected.has(zone)?glass.tinted:glass.original[0]);
  }
  requestRender();
 }
 previewControls.forEach(input=>input.addEventListener('change',updatePreview));
 window.addEventListener('pageshow',updatePreview);

 function configureMaterials(){
  const carbon=carbonMaterial();
  car.traverse(mesh=>{
   if(!mesh.isMesh)return;
   const material=mesh.material;
   if(material.name===config.materials.body){
    material.color.set(config.bodyColor);
    paint={material,originalRoughness:material.roughness};
   }
   if(material.name===config.materials.body||material.name===config.materials.trim){
    assignSpoiler(mesh,carbon);
   }
   if(material.name===config.materials.windows){
    const tinted=material.clone();
    tinted.color.set(0x07090d);
    tinted.transmission=0;
    tinted.transparent=true;
    tinted.opacity=.58;
    tinted.depthWrite=false;
    tinted.side=THREE.FrontSide;
    tinted.roughness=.055;
    tinted.envMapIntensity=.6;
    // Some cabin textures are translucent and must be drawn before the tinted panes.
    mesh.renderOrder=1;
    mesh.geometry.clearGroups();
    config.glassGroups.forEach(({start,count},i)=>mesh.geometry.addGroup(start,count,i));
    glass={mesh,tinted,original:config.glassGroups.map(()=>material),tintedPanes:config.glassGroups.map(()=>tinted)};
   }
  });
  updatePreview();
 }

 loader.load(config.modelUrl,gltf=>{
  car=gltf.scene;
  const bounds=new THREE.Box3().setFromObject(car,true);
  const size=bounds.getSize(new THREE.Vector3());
  const scale=config.modelSize/Math.max(size.x,size.y,size.z);
  carHeight=size.y*scale;
  car.scale.setScalar(scale);
  car.position.copy(bounds.getCenter(new THREE.Vector3()).multiplyScalar(-scale));
  shadow.position.y=-size.y*scale/2+.01;
  shadow.scale.set(size.x*scale/4,size.z*scale/3,1);
  rig.add(car);
  car.updateMatrixWorld(true);
  configureMaterials();

  car.traverse(node=>{
   if(!config.wheels.includes(node.userData.name))return;
   // The first branch of each wheel group is the tire, centered on the group's local X axis.
   const tire=node.children[0].children[0];
   tire.geometry.computeBoundingBox();
   const diameter=tire.geometry.boundingBox.getSize(new THREE.Vector3()).z;
   const axis=new THREE.Vector3(1,0,0).transformDirection(node.matrixWorld);
   wheels.push({
    node,
    rest:node.quaternion.clone(),
    direction:Math.sign(axis.x),
    radius:diameter/2*tire.getWorldScale(new THREE.Vector3()).z,
   });
  });
  loading.hidden=true;
  requestRender();
  if(!visible||footerVisible)window.finishCarLoading?.();
 },undefined,error=>{
  console.error('Не удалось загрузить автомобиль',error);
  fallback('Не удалось загрузить 3D-модель');
 });
}
start();
