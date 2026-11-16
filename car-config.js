export const carSceneConfig = {
 modelUrl:'./assets/2019_porsche_911_991.2_gt3_rs.glb',
 color:'#0F3A8F', bodyColor:'#123878', modelSize:6.4,
 drive: {
  // Exit and entry are measured in hero heights. Parking is measured inside services.
  exitAt: .26,
  enterAt: .40,
  parkAt: -.12,
  parkCenter: .55,
  heroWidth: .74,
  mobileHeroWidth: .84,
  heroMaxScale: 2.05,
  exitX: -.98,
  // [Horizontal position, depth] as fractions of canvas width.
  approach: [[.85,0],[.65,0],[.45,0],[.24,0]],
 },
 materials:{
  body:'991_2phong2SG1',
  trim:'991_2phong3SG1',
  windows:'991_2phong18SG1',
 },
 // The wheel groups already have their origins on the axle and contain the tires, rims and badges.
 wheels:['3DWheel Front L','3DWheel Front R','3DWheel Rear L','3DWheel Rear R'],
 // Index ranges in the model's glass mesh, including both faces of each pane.
 glassGroups:[
  {start:0,count:750,zone:'windshield'},
  {start:750,count:339,zone:'side'},
  {start:1089,count:1074,zone:'rear'}, // Rear window and both rear quarter windows
  {start:2163,count:336,zone:'side'},
 ],
};
