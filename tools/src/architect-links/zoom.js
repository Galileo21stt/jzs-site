/* Canvas zoom: keep the point under the fingers fixed; leave one-finger scrolling native. */
(function(root){
  'use strict';
  function bind(stage,svg,options){
    const width=+svg.getAttribute('width'),height=+svg.getAttribute('height');
    let scale=options.scale || 1, pinch=null, suppressUntil=0;
    function paint(){svg.style.width=width*scale+'px';svg.style.height=height*scale+'px';options.onChange(scale);}
    function point(x,y){const r=stage.getBoundingClientRect();return {x:x-r.left,y:y-r.top};}
    function change(next,at,world){
      next=Math.max(.18,Math.min(2.5,next));
      at=at || {x:stage.clientWidth/2,y:stage.clientHeight/2};
      world=world || {x:(stage.scrollLeft+at.x)/scale,y:(stage.scrollTop+at.y)/scale};
      scale=next; paint();
      stage.scrollLeft=world.x*scale-at.x;stage.scrollTop=world.y*scale-at.y;
    }
    function metrics(t){return {distance:Math.hypot(t[0].clientX-t[1].clientX,t[0].clientY-t[1].clientY),mid:point((t[0].clientX+t[1].clientX)/2,(t[0].clientY+t[1].clientY)/2)};}
    stage.addEventListener('touchstart',e=>{
      if(e.touches.length!==2)return;
      const m=metrics(e.touches); options.onStart();
      pinch={distance:Math.max(1,m.distance),scale,world:{x:(stage.scrollLeft+m.mid.x)/scale,y:(stage.scrollTop+m.mid.y)/scale}};
      if(e.cancelable)e.preventDefault();
    },{passive:false});
    stage.addEventListener('touchmove',e=>{
      if(!pinch || e.touches.length!==2)return;
      if(e.cancelable)e.preventDefault();
      const m=metrics(e.touches);change(pinch.scale*m.distance/pinch.distance,m.mid,pinch.world);
    },{passive:false});
    function end(e){if(pinch && e.touches.length<2){pinch=null;suppressUntil=Date.now()+350;}}
    stage.addEventListener('touchend',end,{passive:true});stage.addEventListener('touchcancel',end,{passive:true});
    stage.addEventListener('click',e=>{if(pinch || Date.now()<suppressUntil){e.preventDefault();e.stopPropagation();}},true);
    paint();return {change,getScale:()=>scale};
  }
  root.ArchitectTreeZoom={bind};
})(typeof window!=='undefined'?window:globalThis);
