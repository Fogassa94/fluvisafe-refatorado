const BAUD_RATE = 115200;

let port;
let reader;

const getElement = id => document.getElementById(id);

const DRAFT_SENSORS = {
  PROA_BB: { value: 'd1', bar: 'b1', pressure: 'p1', badge: 's1badge' },
  POPA_BB: { value: 'd2', bar: 'b2', pressure: 'p2', badge: 's2badge' },
  PROA_EB: { value: 'd3', bar: 'b3', pressure: 'p3', badge: 's3badge' },
  POPA_EB: { value: 'd4', bar: 'b4', pressure: 'p4', badge: 's4badge' }
};

const STATUS_COLORS = {
  BOA: '#1D9E75',
  ATENCAO: '#FAC775',
  CRITICO: '#f56565'
};

const STATUS_LABELS = {
  BOA: 'OPERAÇÃO NORMAL',
  ATENCAO: 'ATENÇÃO',
  CRITICO: 'ALERTA CRÍTICO'
};

async function connectSerial() {
  try {
    port = await navigator.serial.requestPort();
    await port.open({ baudRate: BAUD_RATE });

    const decoder = new TextDecoderStream();
    port.readable.pipeTo(decoder.writable);

    reader = decoder.readable.getReader();
    readLoop();
  } catch (error) {
    console.error('Erro ao conectar Serial:', error);
  }
}

async function readLoop() {
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += value;
    const lines = buffer.split('\n');
    buffer = lines.pop();

    lines.forEach(line => parseLine(line.trim()));
  }
}

function parseLine(line) {
  if (!line) return;

  const lastUpdate = getElement('lastUpdate');
  if (lastUpdate) {
    lastUpdate.textContent = new Date().toLocaleTimeString('pt-BR');
  }

  const parts = line.split(':');

  switch (parts[0]) {
    case 'DRAFT':
      updateDraft(
        parts[1],
        parseFloat(parts[2]),
        parseFloat(parts[3])
      );
      break;

    case 'IMU':
      updateIMU({
        ax: parseFloat(parts[1]),
        ay: parseFloat(parts[2]),
        az: parseFloat(parts[3]),
        gx: parseFloat(parts[4]),
        gy: parseFloat(parts[5]),
        gz: parseFloat(parts[6]),
        roll: parseFloat(parts[7]),
        pitch: parseFloat(parts[8]),
        temp: parseFloat(parts[9]),
        status: parts[10]
      });
      break;

    case 'TRIM':
      updateTrim(parseFloat(parts[1]));
      break;
  }
}

function updateDraft(sensor, draft, pressure) {
  const ids = DRAFT_SENSORS[sensor];
  if (!ids) return;

  const draftElement = getElement(ids.value);
  if (draftElement) {
    draftElement.innerHTML = `${draft.toFixed(2)}<span>m</span>`;
  }

  const barElement = getElement(ids.bar);
  if (barElement) {
    barElement.style.width = `${(draft / 2.0) * 100}%`;
  }

  const pressureElement = getElement(ids.pressure);
  if (pressureElement) {
    pressureElement.textContent = pressure.toFixed(1);
  }

  const badgeElement = getElement(ids.badge);
  if (!badgeElement) return;

  if (draft > 1.8) {
    badgeElement.textContent = 'ALTO';
    badgeElement.style.color = '#f56565';
  } else if (draft > 1.5) {
    badgeElement.textContent = 'ATEN.';
    badgeElement.style.color = '#FAC775';
  } else {
    badgeElement.textContent = 'OK';
    badgeElement.style.color = '';
  }
}

function updateIMU(data) {
  const setText = (id, value) => {
    const element = getElement(id);
    if (element) element.textContent = value;
  };

  setText('ax', `${data.ax >= 0 ? '+' : ''}${data.ax.toFixed(2)} g`);
  setText('ay', `${data.ay >= 0 ? '+' : ''}${data.ay.toFixed(2)} g`);
  setText('az', `${data.az >= 0 ? '+' : ''}${data.az.toFixed(2)} g`);
  setText('gx', `${data.gx.toFixed(1)} °/s`);
  setText('gy', `${data.gy.toFixed(1)} °/s`);
  setText('gz', `${data.gz.toFixed(1)} °/s`);
  setText('tmp', `${data.temp.toFixed(1)} °C`);
  setText('rollVal', `${data.roll.toFixed(1)}°`);
  setText('trimVal', `${data.pitch.toFixed(1)}°`);
  setText('stability', data.status);
  setText('rollStatus', data.status);
  setText('trimStatus', data.status);
  setSystemStatus(data.status);
  updateBubble(data.roll, data.pitch);
}

function setSystemStatus(status) {
  const color = STATUS_COLORS[status] || STATUS_COLORS.BOA;
  const label = STATUS_LABELS[status] || status;

  const systemStatus = getElement('systemStatus');
  if (systemStatus) {
    systemStatus.textContent = label;
  }

  const indicator = getElement('systemIndicator');
  if (indicator) {
    indicator.style.background = color;
    indicator.style.boxShadow = `0 0 10px ${color}`;
  }

  const stability = getElement('stability');
  if (stability) {
    stability.style.color = color;
  }
}

function updateBubble(roll, pitch) {
  const bubble = getElement('attBubble');
  const bubbleOutline = getElement('attBubble2');
  if (!bubble || !bubbleOutline) return;

  const maxOffset = 20;
  const x = Math.max(-maxOffset, Math.min(maxOffset, pitch * 0.8));
  const y = Math.max(-maxOffset, Math.min(maxOffset, roll * 0.8));
  const cx = 330 + x;
  const cy = -1.5 + y;

  bubble.setAttribute('cx', cx);
  bubble.setAttribute('cy', cy);
  bubbleOutline.setAttribute('cx', cx);
  bubbleOutline.setAttribute('cy', cy);
}

function updateTrim(trim) {
  const trimElement = getElement('trimVal');
  if (trimElement) {
    trimElement.textContent = `${trim.toFixed(2)}°`;
  }
}

function startClock() {
  const clock = getElement('clock');
  if (!clock) return;

  const updateClock = () => {
    clock.textContent = new Date().toLocaleTimeString('pt-BR');
  };

  updateClock();
  setInterval(updateClock, 1000);
}

function addConnectButton() {
  const headerStatus = document.querySelector('.header-status');
  if (!headerStatus) return;

  const button = document.createElement('button');
  button.textContent = 'Conectar ESP32';
  button.style.cssText = `
    margin-left: 12px;
    padding: 4px 10px;
    background: #1D9E75;
    color: #fff;
    border: none;
    border-radius: 4px;
    font-size: 11px;
    font-family: inherit;
    cursor: pointer;
  `;

  button.addEventListener('click', async () => {
    await connectSerial();
    button.textContent = 'Conectado';
    button.style.background = '#085041';
    button.disabled = true;
  });

  headerStatus.appendChild(button);
}

document.addEventListener('DOMContentLoaded', () => {
  startClock();
  addConnectButton();
});
