function fetchFiles() {
  const ip = document.getElementById('cameraIpInput').value.trim();
  const statusEl = document.getElementById('status');

  if (!ip) {
    statusEl.innerText = "Please enter a valid IP address.";
    return;
  }

  statusEl.innerText = `Fetching files from ${ip}... Please wait.`;

  fetch(`http://localhost:5000/download?cameraIp=${ip}`)
    .then(res => {
      if (!res.ok) throw new Error("Network response was not ok");
      return res.text();
    })
    .then(data => {
      statusEl.innerText = data;
    })
    .catch(err => {
      statusEl.innerText = `Error: Could not fetch files for IP: ${ip}`;
      console.error(err);
    });
}
