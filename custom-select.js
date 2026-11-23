const SVG_NS = "http://www.w3.org/2000/svg";
const openInstances = new Set();
let globalListenersAttached = false;

function createChevronSvg() {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "custom-select-chevron");
  svg.setAttribute("width", "14");
  svg.setAttribute("height", "14");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2.2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");

  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", "m6 9 6 6 6-6");
  svg.appendChild(path);
  return svg;
}

export function closeAllCustomSelects(exceptInstance = null) {
  for (const instance of openInstances) {
    if (instance !== exceptInstance) {
      instance.close({ restoreFocus: false });
    }
  }
}

function attachGlobalListeners() {
  if (globalListenersAttached || typeof document === "undefined") {
    return;
  }
  globalListenersAttached = true;

  document.addEventListener("pointerdown", (e) => {
    for (const instance of openInstances) {
      if (!instance.containsTarget(e.target)) {
        instance.close({ restoreFocus: false });
      }
    }
  });
}

export function createCustomSelect(container, { ariaLabel = "", onChange } = {}) {
  if (!container) {
    return null;
  }

  attachGlobalListeners();
  container.classList.add("custom-select");
  container.innerHTML = "";

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "custom-select-trigger";
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");
  if (ariaLabel) {
    trigger.setAttribute("aria-label", ariaLabel);
  }

  const labelEl = document.createElement("span");
  labelEl.className = "custom-select-label";
  trigger.appendChild(labelEl);
  trigger.appendChild(createChevronSvg());

  const menu = document.createElement("div");
  menu.className = "custom-select-menu";
  menu.setAttribute("role", "listbox");
  menu.tabIndex = -1;
  menu.hidden = true;
  if (ariaLabel) {
    menu.setAttribute("aria-label", ariaLabel);
  }

  container.appendChild(trigger);
  container.appendChild(menu);

  let flatOptions = [];
  let optionElements = [];
  let currentValue = "";
  let focusedIndex = -1;
  let openState = false;

  const instanceApi = {
    containsTarget(target) {
      return target instanceof Node && container.contains(target);
    },
    close
  };

  function syncVisualSelection() {
    let matched = null;
    for (let i = 0; i < optionElements.length; i += 1) {
      const optEl = optionElements[i];
      const isSelected = optEl.dataset.value === currentValue;
      optEl.classList.toggle("is-selected", isSelected);
      optEl.setAttribute("aria-selected", String(isSelected));
      if (isSelected) {
        matched = flatOptions[i];
      }
    }
    labelEl.textContent = matched ? matched.label : "";
  }

  function setFocusedIndex(nextIndex) {
    if (optionElements.length === 0) {
      focusedIndex = -1;
      return;
    }
    const clamped =
      ((nextIndex % optionElements.length) + optionElements.length) %
      optionElements.length;
    focusedIndex = clamped;
    optionElements.forEach((optEl, idx) => {
      optEl.classList.toggle("is-focused", idx === focusedIndex);
    });
    const activeEl = optionElements[focusedIndex];
    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest" });
    }
  }

  function createOptionElement(opt, index) {
    const optEl = document.createElement("div");
    optEl.className = "custom-select-option";
    optEl.setAttribute("role", "option");
    optEl.dataset.value = opt.value;
    optEl.dataset.index = String(index);
    optEl.setAttribute("aria-selected", "false");

    const textSpan = document.createElement("span");
    textSpan.className = "custom-select-option-label";
    textSpan.textContent = opt.label;
    optEl.appendChild(textSpan);

    optEl.addEventListener("pointerenter", () => {
      setFocusedIndex(index);
    });

    optEl.addEventListener("click", (e) => {
      e.preventDefault();
      selectByIndex(index);
    });

    return optEl;
  }

  function selectByIndex(index) {
    const chosen = flatOptions[index];
    if (!chosen) {
      return;
    }
    const prevValue = currentValue;
    currentValue = chosen.value;
    syncVisualSelection();
    close({ restoreFocus: true });
    if (currentValue !== prevValue && typeof onChange === "function") {
      onChange(currentValue);
    }
  }

  function setOptions(items) {
    menu.innerHTML = "";
    flatOptions = [];
    optionElements = [];

    for (const item of items || []) {
      if (item && Array.isArray(item.options)) {
        const groupEl = document.createElement("div");
        groupEl.className = "custom-select-group";
        groupEl.setAttribute("role", "group");
        if (item.groupLabel) {
          groupEl.setAttribute("aria-label", item.groupLabel);
          const groupLabelEl = document.createElement("div");
          groupLabelEl.className = "custom-select-group-label";
          groupLabelEl.setAttribute("aria-hidden", "true");
          groupLabelEl.textContent = item.groupLabel;
          groupEl.appendChild(groupLabelEl);
        }

        for (const subOpt of item.options) {
          const entry = { value: String(subOpt.value), label: String(subOpt.label) };
          const idx = flatOptions.length;
          flatOptions.push(entry);
          const optEl = createOptionElement(entry, idx);
          optionElements.push(optEl);
          groupEl.appendChild(optEl);
        }
        menu.appendChild(groupEl);
      } else if (item && item.value !== undefined) {
        const entry = { value: String(item.value), label: String(item.label) };
        const idx = flatOptions.length;
        flatOptions.push(entry);
        const optEl = createOptionElement(entry, idx);
        optionElements.push(optEl);
        menu.appendChild(optEl);
      }
    }

    const stillValid = flatOptions.some((o) => o.value === currentValue);
    if (!stillValid) {
      currentValue = flatOptions[0]?.value || "";
    }
    syncVisualSelection();
  }

  function getValue() {
    return currentValue;
  }

  function setValue(val) {
    const strVal = String(val ?? "");
    if (flatOptions.some((o) => o.value === strVal)) {
      currentValue = strVal;
    } else if (flatOptions.length > 0 && !currentValue) {
      currentValue = flatOptions[0].value;
    }
    syncVisualSelection();
  }

  function open() {
    if (openState || flatOptions.length === 0) {
      return;
    }
    closeAllCustomSelects(instanceApi);
    openState = true;
    openInstances.add(instanceApi);
    container.classList.add("is-open");
    trigger.setAttribute("aria-expanded", "true");
    menu.hidden = false;

    const selectedIdx = flatOptions.findIndex((o) => o.value === currentValue);
    setFocusedIndex(selectedIdx >= 0 ? selectedIdx : 0);
    menu.focus({ preventScroll: true });
  }

  function close({ restoreFocus = false } = {}) {
    if (!openState) {
      return;
    }
    openState = false;
    openInstances.delete(instanceApi);
    container.classList.remove("is-open");
    trigger.setAttribute("aria-expanded", "false");
    menu.hidden = true;
    for (const optEl of optionElements) {
      optEl.classList.remove("is-focused");
    }
    focusedIndex = -1;
    if (restoreFocus) {
      trigger.focus();
    }
  }

  trigger.addEventListener("click", () => {
    if (openState) {
      close({ restoreFocus: false });
    } else {
      open();
    }
  });

  trigger.addEventListener("keydown", (e) => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      open();
    }
  });

  menu.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex(focusedIndex + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex(focusedIndex - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      setFocusedIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setFocusedIndex(optionElements.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (focusedIndex >= 0) {
        selectByIndex(focusedIndex);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close({ restoreFocus: true });
    } else if (e.key === "Tab") {
      close({ restoreFocus: false });
    }
  });

  return {
    setOptions,
    getValue,
    setValue,
    open,
    close,
    isOpen: () => openState
  };
}
