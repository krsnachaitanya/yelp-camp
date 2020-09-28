function closebtn() {
  const closebtns = document.getElementsByClassName("close");

  for (let i = 0; i < closebtns.length; i++) {
    closebtns[i].parentElement.style.display = 'none';
  }
}