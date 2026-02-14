let data66 = null, data69 = null;
let selectedParties = new Set();
let currentVoteType = 'Both';

google.charts.load('current', {'packages':['sankey']});

async function init() {
    try {
        // อ้างอิง path สัมพัทธ์กับตัว HTML (ซึ่งอยู่ที่ root)
        const [res69, res66] = await Promise.all([
            fetch('../data/election_data_69.json').then(r => {
                if (!r.ok) throw new Error('หาไฟล์ 69 ไม่เจอ');
                return r.json();
            }),
            fetch('../data/election_data_66.json').then(r => {
                if (!r.ok) throw new Error('หาไฟล์ 66 ไม่เจอ');
                return r.json();
            })
        ]);
        
        data69 = res69;
        data66 = res66;
        renderPartyList();
        console.log("โหลดข้อมูลสำเร็จ");
        
    } catch (e) {
        // แสดง Error จริงๆ ออกมาใน Console เพื่อจะได้รู้ว่าเป็นเพราะ CORS หรือหาไฟล์ไม่เจอจริงๆ
        console.error("เกิดข้อผิดพลาดในการโหลดข้อมูล:", e.message);
        const container = document.getElementById('sankey_main');
        container.innerHTML = `<div class="p-10 text-red-500 text-center">
            <p class="text-xl font-bold">ไม่สามารถโหลดไฟล์ข้อมูลได้</p>
            <p class="text-sm">${e.message}</p>
        </div>`;
    }
}

function renderPartyList() {
    const filter = document.getElementById('partySearch').value.toLowerCase();
    const container = document.getElementById('partyList');
    container.innerHTML = "";
    
    data69.parties.filter(p => p.สังกัดพรรค.toLowerCase().includes(filter))
        .sort((a,b) => a.สังกัดพรรค.localeCompare(b.สังกัดพรรค, 'th'))
        .forEach(p => {
            const div = document.createElement('div');
            div.className = "flex items-center gap-2 p-3 rounded-xl border border-slate-100 hover:bg-blue-50 cursor-pointer";
            const isChecked = selectedParties.has(p.สังกัดพรรค) ? "checked" : "";
            div.innerHTML = `
                <input type="checkbox" value="${p.สังกัดพรรค}" id="chk_${p.สังกัดพรรค}" ${isChecked} class="party-checkbox w-4 h-4 accent-blue-600">
                <label for="chk_${p.สังกัดพรรค}" class="flex-1 cursor-pointer flex items-center gap-2 truncate text-[11px] font-bold text-slate-700">
                    <img src="${p.โลโก้พรรค}" class="w-6 h-6 object-contain rounded bg-white p-0.5 shadow-sm">
                    ${p.สังกัดพรรค}
                </label>`;
            container.appendChild(div);
        });

    document.querySelectorAll('.party-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
            if(e.target.checked) selectedParties.add(e.target.value);
            else selectedParties.delete(e.target.value);
            document.getElementById('selectedCount').textContent = selectedParties.size;
        });
    });
}

function updateDashboard() {
    document.getElementById('selectorModal').classList.remove('active');
    const container = document.getElementById('sankey_main');
    const onlySingle = document.getElementById('singleDigitOnly').checked;

    if (selectedParties.size === 0) {
        container.innerHTML = '<div class="h-full flex flex-col items-center justify-center text-slate-300 italic text-center p-10"><div class="text-9xl mb-8 opacity-10">🔍</div><p class="text-2xl font-bold">กรุณาเลือกพรรคการเมือง</p></div>';
        document.getElementById('insightSection').innerHTML = "";
        return;
    }

    const aggregated = {}, pTotals = {}, pProvinces = {};
    data69.flow.forEach(f => {
        if (selectedParties.has(f.party)) {
            const matchType = currentVoteType === 'Both' || f.vote_type === currentVoteType;
            const matchDigit = !onlySingle || f.is_single_digit;
            if (matchType && matchDigit) {
                const key = `${f.prov}➔${f.party}`;
                aggregated[key] = (aggregated[key] || 0) + f.votes;
                pTotals[f.party] = (pTotals[f.party] || 0) + f.votes;
                if(!pProvinces[f.party]) pProvinces[f.party] = {};
                pProvinces[f.party][f.prov] = (pProvinces[f.party][f.prov] || 0) + f.votes;
            }
        }
    });

    const dataTable = new google.visualization.DataTable();
    dataTable.addColumn('string', 'From'); dataTable.addColumn('string', 'To');
    dataTable.addColumn('number', 'Votes'); dataTable.addColumn({type: 'string', role: 'style'});

    Object.entries(aggregated).forEach(([key, votes]) => {
        const [prov, party] = key.split('➔');
        const pMeta = data69.parties.find(p => p.สังกัดพรรค === party);
        dataTable.addRow([prov, `${party} (รวม: ${pTotals[party].toLocaleString()})`, votes, `color: ${pMeta.สีพรรค}; opacity: 0.5;`]);
    });

    const chart = new google.visualization.Sankey(container);
    chart.draw(dataTable, { height: 1500, sankey: { node: { label: { fontSize: 11, fontName: 'Sarabun', bold: true }, nodePadding: 14, width: 30 }, link: { colorMode: 'source' } } });
    renderInsightPanels(pProvinces);
}

function renderInsightPanels(pProvinces) {
    const container = document.getElementById('insightSection');
    container.innerHTML = "";
    Array.from(selectedParties).sort().forEach(pName => {
        const pData = pProvinces[pName]; if(!pData) return;
        const top5 = Object.entries(pData).sort((a,b) => b[1] - a[1]).slice(0, 5);
        const switchList = data66.switchers.filter(s => s.party_69 === pName).sort((a,b) => b.diff - a.diff).slice(0, 10);
        const pMeta = data69.parties.find(p => p.สังกัดพรรค === pName);

        const row = document.createElement('div');
        row.className = "card p-8 space-y-8";
        row.innerHTML = `
            <div class="flex items-center gap-6 border-b pb-6">
                <img src="${pMeta.โลโก้พรรค}" class="w-20 h-20 object-contain rounded-3xl bg-white border-4 p-1 shadow-md" style="border-color: ${pMeta.สีพรรค}">
                <h3 class="text-4xl font-black text-slate-800">${pName}</h3>
            </div>
            <div class="grid grid-cols-1 xl:grid-cols-2 gap-10">
                <div class="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                    <h4 class="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 italic">📍 5 อันดับจังหวัดฐานเสียงหลัก</h4>
                    ${top5.map(([prov, v], i) => `
                        <div class="flex justify-between items-center py-2 border-b border-white last:border-0 font-bold">
                            <span class="text-slate-600">${i+1}. ${prov}</span>
                            <span class="text-blue-600 font-mono text-lg">${v.toLocaleString()}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="p-6 bg-amber-50/50 rounded-3xl border border-amber-100">
                    <h4 class="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 italic">🤝 วิเคราะห์การย้ายพรรค (แยกชื่อ-นามสกุล)</h4>
                    <div class="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                        ${switchList.map(s => `
                            <div class="p-4 bg-white rounded-2xl shadow-sm flex justify-between items-center">
                                <div>
                                    <p class="font-black text-slate-800 text-base leading-none">${s.first_name}</p>
                                    <p class="text-[10px] text-slate-500 font-bold mt-1">${s.last_name}</p>
                                    <p class="text-[9px] text-blue-600 font-black uppercase mt-1 italic">${s.party_66} ➔ ${s.party_69}</p>
                                </div>
                                <div class="text-right">
                                    <p class="${s.diff >= 0 ? 'text-emerald-600' : 'text-red-600'} font-black text-xl leading-none">${s.diff >= 0 ? '+' : ''}${s.diff.toLocaleString()}</p>
                                    <p class="text-[9px] font-bold text-slate-400 uppercase mt-1">${s.จังหวัด}</p>
                                </div>
                            </div>
                        `).join('') || '<p class="text-center text-slate-400 py-10 italic">ไม่พบข้อมูลย้ายพรรค</p>'}
                    </div>
                </div>
            </div>`;
        container.appendChild(row);
    });
}

function selectAll(val) {
    if(val) data69.parties.forEach(p => selectedParties.add(p.สังกัดพรรค));
    else selectedParties.clear();
    renderPartyList();
}

function setVoteType(type) {
    currentVoteType = type;
    document.querySelectorAll('.vote-type-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('btn_' + type).classList.add('active');
}

function toggleModal(show) { document.getElementById('selectorModal').classList.toggle('active', show); }
document.getElementById('partySearch').addEventListener('input', renderPartyList);
init();