/**
 * MODULE: Custom Searchable Combobox (combobox.js)
 * Creates a premium searchable select dropdown that allows selecting an existing item
 * or typing to add a new custom option (open list).
 */

export class Combobox {
  /**
   * @param {HTMLElement} container - Wrapper element
   * @param {object} config - Configuration object
   */
  constructor(container, { options = [], placeholder = '', id = '', required = false, name = '', value = '' }) {
    this.container = container;
    this.options = Array.isArray(options) ? options : [];
    this.placeholder = placeholder;
    this.id = id;
    this.required = required;
    this.name = name;
    this.selectedValue = value;
    
    this.isOpen = false;
    this.activeIndex = -1;
    this.filteredOptions = [...this.options];

    this.init();
  }

  init() {
    this.container.innerHTML = '';
    this.container.classList.add('combobox-container');
    
    // Create wrapper for input & icon
    const wrapper = document.createElement('div');
    wrapper.className = 'combobox-input-wrapper';
    
    // Text Input
    this.input = document.createElement('input');
    this.input.type = 'text';
    this.input.id = this.id;
    this.input.name = this.name;
    this.input.placeholder = this.placeholder;
    this.input.required = this.required;
    this.input.value = this.selectedValue;
    this.input.autocomplete = 'off';
    wrapper.appendChild(this.input);
    
    // Dropdown Chevron Icon
    const chevron = document.createElement('div');
    chevron.className = 'combobox-chevron';
    chevron.innerHTML = '<i data-lucide="chevron-down"></i>';
    wrapper.appendChild(chevron);
    
    this.container.appendChild(wrapper);
    
    // Dropdown Panel
    this.dropdown = document.createElement('div');
    this.dropdown.className = 'combobox-dropdown';
    this.container.appendChild(this.dropdown);
    
    // Initialize Lucide Icons for this chevron
    if (window.lucide) {
      window.lucide.createIcons({
        attrs: { 'stroke-width': 2 },
        nameAttr: 'data-lucide',
        nodeList: [chevron]
      });
    }
    
    this.bindEvents();
    this.renderOptions();
  }

  bindEvents() {
    // Open on focus or click
    this.input.addEventListener('focus', () => this.open());
    this.input.addEventListener('click', (e) => {
      e.stopPropagation();
      this.open();
    });
    
    // Toggle on chevron click
    const chevron = this.container.querySelector('.combobox-chevron');
    chevron.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });
    
    // Filter on keystroke
    this.input.addEventListener('input', () => {
      this.open();
      this.filter(this.input.value);
    });
    
    // Keyboard navigation
    this.input.addEventListener('keydown', (e) => this.handleKeyDown(e));
    
    // Click outside closes dropdown
    document.addEventListener('click', (e) => {
      if (!this.container.contains(e.target)) {
        this.close();
      }
    });
  }

  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    this.container.classList.add('open');
    this.activeIndex = -1;
    this.filteredOptions = [...this.options]; // Reset list to show all options initially
    this.renderOptions(this.input.value);
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.container.classList.remove('open');
    this.selectedValue = this.input.value;
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.input.focus();
      this.open();
    }
  }

  filter(query) {
    const q = query.toLowerCase().trim();
    if (q === '') {
      this.filteredOptions = [...this.options];
    } else {
      this.filteredOptions = this.options.filter(opt => opt.toLowerCase().includes(q));
    }
    this.activeIndex = -1;
    this.renderOptions(query);
  }

  renderOptions(query = '') {
    this.dropdown.innerHTML = '';
    
    const items = [...this.filteredOptions];
    const cleanQuery = query.trim();
    
    // If the input value doesn't exactly match any option, offer to add it (Open Dropdown)
    const exactMatch = items.some(item => item.toLowerCase() === cleanQuery.toLowerCase());
    const showNewValOption = cleanQuery !== '' && !exactMatch;
    
    if (items.length === 0 && !showNewValOption) {
      const empty = document.createElement('div');
      empty.className = 'combobox-no-results';
      empty.textContent = 'Escribe para añadir...';
      this.dropdown.appendChild(empty);
      return;
    }
    
    // Render existing matching options
    items.forEach((opt, idx) => {
      const div = document.createElement('div');
      div.className = 'combobox-item';
      if (opt === this.selectedValue) {
        div.classList.add('selected');
      }
      if (idx === this.activeIndex) {
        div.classList.add('active');
        div.style.backgroundColor = 'var(--bg-input)';
      }
      div.textContent = opt;
      div.addEventListener('click', (e) => {
        e.stopPropagation();
        this.select(opt);
      });
      this.dropdown.appendChild(div);
    });
    
    // Render the "Add new option" item
    if (showNewValOption) {
      const addDiv = document.createElement('div');
      addDiv.className = 'combobox-item combobox-new-option';
      if (items.length === this.activeIndex) {
        addDiv.classList.add('active');
        addDiv.style.backgroundColor = 'var(--bg-input)';
      }
      
      const spanVal = document.createElement('span');
      spanVal.textContent = cleanQuery;
      addDiv.appendChild(spanVal);
      
      const badge = document.createElement('span');
      badge.className = 'combobox-new-badge';
      badge.textContent = 'Nuevo';
      addDiv.appendChild(badge);
      
      addDiv.addEventListener('click', (e) => {
        e.stopPropagation();
        this.select(cleanQuery);
      });
      this.dropdown.appendChild(addDiv);
    }
  }

  select(value) {
    this.input.value = value;
    this.selectedValue = value;
    this.close();
    
    // Dispatch standard change event on the input
    const event = new Event('change', { bubbles: true });
    this.input.dispatchEvent(event);
  }

  handleKeyDown(e) {
    const items = this.dropdown.querySelectorAll('.combobox-item');
    if (!this.isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        this.open();
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      this.activeIndex = (this.activeIndex + 1) % items.length;
      this.updateActiveItem(items);
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      this.activeIndex = (this.activeIndex - 1 + items.length) % items.length;
      this.updateActiveItem(items);
      e.preventDefault();
    } else if (e.key === 'Enter') {
      if (this.activeIndex >= 0 && this.activeIndex < items.length) {
        items[this.activeIndex].click();
      } else if (this.input.value.trim() !== '') {
        this.select(this.input.value);
      }
      e.preventDefault();
    } else if (e.key === 'Escape') {
      this.close();
      e.preventDefault();
    }
  }

  updateActiveItem(items) {
    items.forEach((item, idx) => {
      if (idx === this.activeIndex) {
        item.classList.add('active');
        item.style.backgroundColor = 'var(--bg-input)';
        item.scrollIntoView({ block: 'nearest' });
      } else {
        item.classList.remove('active');
        item.style.backgroundColor = '';
      }
    });
  }

  getValue() {
    return this.input.value.trim();
  }

  setValue(val) {
    this.selectedValue = val;
    this.input.value = val;
  }
}
