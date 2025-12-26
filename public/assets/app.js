(function(){
  const toastEl = document.createElement("div");
  toastEl.style.position="fixed";
  toastEl.style.bottom="18px";
  toastEl.style.right="18px";
  toastEl.style.zIndex="9999";
  toastEl.style.display="grid";
  toastEl.style.gap="8px";
  document.body.appendChild(toastEl);

  window.toast = function(msg){
    const n = document.createElement("div");
    n.textContent = msg;
    n.style.padding="10px 12px";
    n.style.borderRadius="12px";
    n.style.border="1px solid rgba(255,255,255,.14)";
    n.style.background="rgba(0,0,0,.7)";
    n.style.color="#fff";
    n.style.fontSize="13px";
    toastEl.appendChild(n);
    setTimeout(()=>{ n.style.opacity="0"; n.style.transition="opacity .3s"; }, 1400);
    setTimeout(()=>{ n.remove(); }, 1800);
  }
})();
