/* ============================================================
   DAILY PRODUCTION SCOREBOARD — JavaScript
   Generates call log rows & handles design switching
   ============================================================ */

document.addEventListener('DOMContentLoaded', function() {
    generateCallLogRows('call-log-body', 20, 'executive');
    generateCallLogRows('min-call-log-body', 20, 'minimal');
});

/**
 * Generate call log table rows
 */
function generateCallLogRows(tbodyId, count, style) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    
    for (let i = 1; i <= count; i++) {
        const tr = document.createElement('tr');
        
        if (style === 'executive') {
            tr.innerHTML = `
                <td class="row-num">${i}</td>
                <td></td>
                <td class="tier-codes">${i === 1 ? 'T1 T2 T3' : ''}</td>
                <td class="result-codes">${i === 1 ? 'S  VM  A  NA  B  CB' : ''}</td>
                <td></td>
            `;
        } else {
            tr.innerHTML = `
                <td class="row-num" style="text-align:center;color:#A0A0A0;font-size:7px;">${i}</td>
                <td></td>
                <td style="text-align:center;color:#A0A0A0;font-size:7px;">${i === 1 ? '1 · 2 · 3' : ''}</td>
                <td style="text-align:center;color:#A0A0A0;font-size:7px;">${i === 1 ? 'S VM A NA B CB' : ''}</td>
                <td></td>
            `;
        }
        
        tbody.appendChild(tr);
    }
}

/**
 * Switch between design variants
 */
function switchDesign(design) {
    const executiveEl = document.getElementById('design-executive');
    const minimalEl = document.getElementById('design-minimal');
    
    // Hide all
    executiveEl.style.display = 'none';
    minimalEl.style.display = 'none';
    
    // Show selected
    if (design === 'executive') {
        executiveEl.style.display = 'block';
    } else {
        minimalEl.style.display = 'block';
    }
    
    // Update button states
    document.querySelectorAll('.btn-design').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.design === design);
    });
    
    // Smooth scroll to the design
    const targetEl = design === 'executive' ? executiveEl : minimalEl;
    targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
