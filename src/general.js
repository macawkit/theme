for (const list of document.querySelectorAll('[role="tablist"]')) {
    list.addEventListener('click', event => {
        const tab = event.target.closest('[role="tab"]');
        if (!tab)
            return;

        for (const candidate of list.querySelectorAll('[role="tab"]')) {
            const selected = candidate === tab;
            candidate.setAttribute('aria-selected', String(selected));
            candidate.tabIndex = selected ? 0 : -1;

            const id = candidate.getAttribute('aria-controls');
            const panel = document.getElementById(id);
            if (panel)
                panel.hidden = !selected;
        }
    });

    list.addEventListener('keydown', event => {
        const current = event.target.closest('[role="tab"]');
        if (!current)
            return;

        const tabs = [...list.querySelectorAll('[role="tab"]')];
        const index = tabs.indexOf(current);
        let next;

        if (event.key === 'ArrowRight')
            next = tabs[(index + 1) % tabs.length];
        else if (event.key === 'ArrowLeft')
            next = tabs[(index - 1 + tabs.length) % tabs.length];
        else if (event.key === 'Home')
            next = tabs[0];
        else if (event.key === 'End')
            next = tabs.at(-1);
        else
            return;

        event.preventDefault();
        
        for (const candidate of list.querySelectorAll('[role="tab"]')) {
            const selected = candidate === next;
            candidate.setAttribute('aria-selected', String(selected));
            candidate.tabIndex = selected ? 0 : -1;

            const id = candidate.getAttribute('aria-controls');
            const panel = document.getElementById(id);
            if (panel)
                panel.hidden = !selected;
        }

        next.focus();
    });
}

for (const spark of document.querySelectorAll('.spark')) {
    const valuesString = spark.dataset.values;
    if (!valuesString)
        continue;

    const values = valuesString.split(',').map(Number);
    const maxValue = Math.max(...values);
    
    if (values.length === 0)
        continue;

    for (const child of spark.children)
        child.remove();

    for (const value of values) {
        const bar = document.createElement('i');
        bar.style.height = `${value / maxValue * 100}%`;
        spark.append(bar);
    }
}

for (const meter of document.querySelectorAll('div[role="meter"]')) {
    const value = meter.getAttribute('aria-valuenow');
    if (!value)
        continue;

    const min = meter.getAttribute('aria-valuemin') || 0;
    const max = meter.getAttribute('aria-valuemax') || 100;
    const range = max - min;
    const percentage = (value - min) / range * 100;

    meter.style.setProperty('--value', `${percentage}%`);
}