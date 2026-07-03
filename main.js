const status = document.querySelector('.status')
if (status) {
  status.textContent = `Local dev server is running · ${new Date().toLocaleString()}`
}
