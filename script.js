// Precios fijos (solo modificables en el código)  
const NORMAL_OVERTIME_RATE = 23.00; // Q23.00 por hora extra normal  
const SPECIAL_OVERTIME_RATE = 31.00; // Q31.00 por hora extra especial  
const DEFAULT_DOUBLE_DAY_RATE = 250.00; // Valor por defecto para día doble
const DOUBLE_DAY_HOURS = 9; // Horas que cubre el día doble
  
// Lista de días festivos en Guatemala (puedes agregar más)  
const GUATEMALA_HOLIDAYS = [  
    '2023-01-01', // Año Nuevo  
    '2023-04-06', // Jueves Santo  
    '2023-04-07', // Viernes Santo  
    '2023-05-01', // Día del Trabajo  
    '2023-06-30', // Día del Ejército  
    '2023-09-15', // Día de la Independencia  
    '2023-10-20', // Día de la Revolución  
    '2023-11-01', // Día de Todos los Santos  
    '2023-12-24', // Nochebuena (medio día)  
    '2023-12-25', // Navidad  
    '2023-12-31', // Víspera de Año Nuevo (medio día)  
    // Agrega aquí más fechas de años siguientes...  
    '2024-01-01', '2024-03-28', '2024-03-29', '2024-05-01', '2024-06-30', 
    '2024-09-15', '2024-10-20', '2024-11-01', '2024-12-24', '2024-12-25', '2024-12-31'
];  

// Horarios laborales definidos para cada grupo (entre semana y sábado unidos)  
const WORK_SCHEDULES = {  
    group1: {  
        weekday: { start: 7, end: 16, duration: 9 }, // L-V: 7:00am - 4:00pm (9 horas incluyendo almuerzo)  
        saturday: { start: 7, end: 11, duration: 4 }  // Sábado: 7:00am - 11:00am (4 horas)  
    },  
    group2: {  
        weekday: { start: 8, end: 17, duration: 9 }, // L-V: 8:00am - 5:00pm (9 horas incluyendo almuerzo)  
        saturday: { start: 8, end: 12, duration: 4 }  // Sábado: 8:00am - 12:00pm (4 horas)  
    }  
};  

// Variables globales
let editingIndex = -1;
let isEditing = false;

document.addEventListener('DOMContentLoaded', function() {  
    const form = document.getElementById('schedule-form');  
    const historyTable = document.getElementById('schedule-history').querySelector('tbody');  
    const exportBtn = document.getElementById('export-btn');
    const clearBtn = document.getElementById('clear-btn');
    const printBtn = document.getElementById('print-btn');
    const pdfBtn = document.getElementById('pdf-btn');
    const toast = document.getElementById('toast');
    const isDoubleDayCheckbox = document.getElementById('is-double-day');
    const doubleDayInfo = document.getElementById('double-day-info');
    const doubleDayRateGroup = document.getElementById('double-day-rate-group');
    const dateInput = document.getElementById('date');
      
    // Cargar historial desde localStorage  
    loadHistory();  
    updateOvertimeSummary();  
      
    // Establecer la fecha actual por defecto  
    const today = new Date();  
    const formattedDate = formatDateForInput(today);  
    document.getElementById('date').value = formattedDate;  
    document.getElementById('end-date').value = formattedDate;  
    document.getElementById('double-day-rate').value = DEFAULT_DOUBLE_DAY_RATE.toFixed(2);
    
    // Event listeners para campos del formulario (cálculo en tiempo real)
    const formInputs = form.querySelectorAll('input');
    formInputs.forEach(input => {
        input.addEventListener('change', updateRealTimePreview);
        input.addEventListener('input', updateRealTimePreview);
    });
    
    // Event listener para el checkbox de día doble
    isDoubleDayCheckbox.addEventListener('change', function() {
        if (this.checked) {
            doubleDayInfo.style.display = 'block';
            doubleDayRateGroup.style.display = 'block';
            // Verificar si la fecha seleccionada es domingo o festivo
            checkDoubleDayEligibility();
        } else {
            doubleDayInfo.style.display = 'none';
            doubleDayRateGroup.style.display = 'none';
        }
        updateRealTimePreview();
    });
    
    // Event listener para cambio de fecha
    dateInput.addEventListener('change', function() {
        if (isDoubleDayCheckbox.checked) {
            checkDoubleDayEligibility();
        }
        updateRealTimePreview();
    });
    
    // Event listener para exportar datos
    exportBtn.addEventListener('click', exportToCSV);
    
    // Event listener para limpiar historial
    clearBtn.addEventListener('click', clearHistory);
    
    // Event listener para imprimir
    printBtn.addEventListener('click', printResults);
    
    // Event listener para exportar a PDF
    pdfBtn.addEventListener('click', exportToPDF);
      
    form.addEventListener('submit', function(e) {  
        e.preventDefault();  
          
        const workGroup = document.querySelector('input[name="work-group"]:checked')?.value;  
        const startDate = document.getElementById('date').value;  
        const startTime = document.getElementById('start-time').value;  
        let endDate = document.getElementById('end-date').value;  
        const endTime = document.getElementById('end-time').value;  
        const location = document.getElementById('location').value;  
        const isHoliday = document.getElementById('is-holiday').checked;  
        const isDoubleDay = document.getElementById('is-double-day').checked;  
        const doubleDayRate = parseFloat(document.getElementById('double-day-rate').value) || DEFAULT_DOUBLE_DAY_RATE;  
        const description = document.getElementById('description').value;  
          
        if (!workGroup || !startDate || !startTime || !endTime || !location) {  
            showToast('Por favor, complete todos los campos obligatorios.', 'error');
            return;  
        }  
          
        // Si no se especifica fecha de fin, usar la misma fecha de inicio  
        if (!endDate) {  
            endDate = startDate;  
        }  
          
        // Validar que la fecha de fin no sea anterior a la de inicio
        const startDateTime = new Date(`${startDate}T${startTime}`);
        const endDateTime = new Date(`${endDate}T${endTime}`);
        
        if (endDateTime <= startDateTime) {
            showToast('La fecha/hora de fin debe ser posterior a la de inicio.', 'error');
            return;
        }
        
        // Validar día doble
        if (isDoubleDay && !isDoubleDayEligible(startDate, isHoliday)) {
            showToast('El día doble solo aplica para domingos y días festivos.', 'error');
            return;
        }
          
        // Calcular horas trabajadas  
        const { totalHours, normalHours, overtimeHours, doubleDayApplied } = calculateHours(  
            workGroup, startDate, startTime, endDate, endTime, isHoliday, isDoubleDay  
        );  
          
        // Calcular montos  
        const normalAmount = overtimeHours.normal * NORMAL_OVERTIME_RATE;  
        const specialAmount = overtimeHours.special * SPECIAL_OVERTIME_RATE;  
        const doubleDayAmount = doubleDayApplied ? doubleDayRate : 0;
        const totalAmount = normalAmount + specialAmount + doubleDayAmount;  
          
        if (isEditing) {
            // Actualizar registro existente
            updateSchedule(
                editingIndex,
                workGroup, startDate, endDate, startTime, endTime,   
                totalHours, normalHours, overtimeHours, doubleDayApplied, doubleDayRate,
                normalAmount, specialAmount, doubleDayAmount, location, description, isHoliday, isDoubleDay  
            );
            showToast('Registro actualizado correctamente.', 'success');
            isEditing = false;
            editingIndex = -1;
            form.querySelector('button[type="submit"]').textContent = 'Guardar y Calcular';
        } else {
            // Guardar el registro nuevo
            saveSchedule(  
                workGroup, startDate, endDate, startTime, endTime,   
                totalHours, normalHours, overtimeHours, doubleDayApplied, doubleDayRate,
                normalAmount, specialAmount, doubleDayAmount, location, description, isHoliday, isDoubleDay  
            );  
            showToast('Registro guardado correctamente.', 'success');
        }
          
        // Actualizar la interfaz  
        loadHistory();
        updateOvertimeSummary();  
          
        // Limpiar el formulario pero mantener las fechas  
        document.getElementById('start-time').value = '';  
        document.getElementById('end-time').value = '';  
        document.getElementById('location').value = '';  
        document.getElementById('description').value = '';  
        document.getElementById('is-holiday').checked = false;  
        document.getElementById('is-double-day').checked = false;
        doubleDayInfo.style.display = 'none';
        doubleDayRateGroup.style.display = 'none';
    });  

    // FUNCIÓN CORREGIDA: Formatear fecha para input
    function formatDateForInput(date) {  
        const year = date.getFullYear();  
        const month = String(date.getMonth() + 1).padStart(2, '0');  
        const day = String(date.getDate()).padStart(2, '0');  
        return `${year}-${month}-${day}`;  
    }
    
    // FUNCIÓN CORREGIDA: Detección correcta de días de la semana
    function getDayOfWeek(dateString) {
        // Crear fecha en formato YYYY-MM-DD sin problemas de zona horaria
        const [year, month, day] = dateString.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        return date.getDay(); // 0=Domingo, 1=Lunes, ..., 6=Sábado
    }
    
    function isSunday(dateString) {
        return getDayOfWeek(dateString) === 0;
    }
    
    function isDoubleDayEligible(dateString, isHoliday) {
        return isSunday(dateString) || isHoliday || isHolidayDate(dateString);
    }
    
    function checkDoubleDayEligibility() {
        const dateValue = dateInput.value;
        const isHoliday = document.getElementById('is-holiday').checked;
        
        if (!dateValue) return;
        
        if (!isDoubleDayEligible(dateValue, isHoliday)) {
            showToast('El día doble solo aplica para domingos y días festivos.', 'error');
            document.getElementById('is-double-day').checked = false;
            doubleDayInfo.style.display = 'none';
            doubleDayRateGroup.style.display = 'none';
        }
    }
    
    // FUNCIÓN COMPLETAMENTE CORREGIDA - Maneja transiciones entre días
    function calculateHours(workGroup, startDate, startTime, endDate, endTime, isHoliday, isDoubleDay) {  
        const startDateTime = createDateWithoutTimezone(startDate, startTime);
        const endDateTime = createDateWithoutTimezone(endDate, endTime);
          
        if (endDateTime <= startDateTime) {  
            endDateTime.setDate(endDateTime.getDate() + 1);  
        }  
          
        const totalHours = Math.round((endDateTime - startDateTime) / (1000 * 60 * 60) * 100) / 100;  
          
        let normalHours = 0;  
        let overtimeNormal = 0;  
        let overtimeSpecial = 0;  
        
        const schedule = WORK_SCHEDULES[workGroup];  
        let currentTime = new Date(startDateTime);
        
        // Procesar cada hora del período
        while (currentTime < endDateTime) {
            const hourEnd = new Date(currentTime);
            hourEnd.setHours(currentTime.getHours() + 1);
            if (hourEnd > endDateTime) hourEnd.setTime(endDateTime.getTime());
            
            const hourDuration = (hourEnd - currentTime) / 3600000;
            const dayOfWeek = currentTime.getDay();
            const hourOfDay = currentTime.getHours();
            const currentDateStr = formatDateForInput(currentTime);
            
            // Verificar si es feriado o domingo
            if (isHolidayDate(currentDateStr) || dayOfWeek === 0) {
                overtimeSpecial += hourDuration;
                currentTime = hourEnd;
                continue;
            }
            
            // Para días laborales
            let daySchedule = null;
            if (dayOfWeek >= 1 && dayOfWeek <= 5) {
                daySchedule = schedule.weekday;
            } else if (dayOfWeek === 6) {
                daySchedule = schedule.saturday;
            }
            
            if (daySchedule) {
                const isWithinSchedule = hourOfDay >= daySchedule.start && hourOfDay < daySchedule.end;
                
                if (isWithinSchedule) {
                    normalHours += hourDuration;
                } else {
                    // Determinar tipo de hora extra
                    if (dayOfWeek === 6) { // Sábado
                        if (hourOfDay < daySchedule.start) {
                            overtimeNormal += hourDuration;
                        } else {
                            overtimeSpecial += hourDuration;
                        }
                    } else { // Lunes a Viernes
                        // Manejar transición domingo→lunes (12am-1am)
                        if (dayOfWeek === 1 && hourOfDay >= 0 && hourOfDay < 1) {
                            overtimeSpecial += hourDuration;
                        } else {
                            overtimeNormal += hourDuration;
                        }
                    }
                }
            } else {
                // Para cualquier otro caso (debería ser solo domingos, ya manejados arriba)
                overtimeSpecial += hourDuration;
            }
            
            currentTime = hourEnd;
        }
        
        // Manejar día doble para días festivos/domingos
        let doubleDayApplied = false;
        const isStartHoliday = isHoliday || isHolidayDate(startDate) || getDayOfWeek(startDate) === 0;
        
        if (isStartHoliday && isDoubleDay && isDoubleDayEligible(startDate, isHoliday)) {
            doubleDayApplied = true;
            // Ajustar: las primeras 9 horas se pagan como día doble, el resto como especiales
            if (totalHours > DOUBLE_DAY_HOURS) {
                overtimeSpecial = totalHours - DOUBLE_DAY_HOURS;
            } else {
                overtimeSpecial = 0;
            }
        }
        
        return {   
            totalHours,   
            normalHours: Math.round(normalHours * 100) / 100,   
            overtimeHours: { 
                normal: Math.round(overtimeNormal * 100) / 100, 
                special: Math.round(overtimeSpecial * 100) / 100 
            },
            doubleDayApplied
        };  
    }
    
    // Función auxiliar para crear fechas sin problemas de zona horaria
    function createDateWithoutTimezone(dateString, timeString) {
        const [year, month, day] = dateString.split('-').map(Number);
        const [hours, minutes] = timeString.split(':').map(Number);
        return new Date(year, month - 1, day, hours, minutes);
    }
      
    function isHolidayDate(dateString) {  
        return GUATEMALA_HOLIDAYS.includes(dateString);  
    }  
      
    function getGroupName(groupKey) {  
        const groups = {  
            'group1': 'Grupo 1',  
            'group2': 'Grupo 2'  
        };  
        return groups[groupKey] || groupKey;  
    }  
      
    function saveSchedule(workGroup, startDate, endDate, startTime, endTime, totalHours, normalHours, overtimeHours, doubleDayApplied, doubleDayRate, normalAmount, specialAmount, doubleDayAmount, location, description, isHoliday, isDoubleDay) {  
        let schedules = JSON.parse(localStorage.getItem('workSchedules')) || [];  
          
        schedules.push({  
            workGroup,  
            startDate,  
            endDate,  
            startTime,  
            endTime,  
            totalHours,  
            normalHours,  
            overtimeHours,  
            doubleDayApplied,
            doubleDayRate,
            doubleDayAmount,
            normalAmount,  
            specialAmount,  
            location,  
            description,  
            isHoliday,
            isDoubleDay,
            id: Date.now() // Agregar ID único para mejor manejo
        });  
          
        localStorage.setItem('workSchedules', JSON.stringify(schedules));  
    }
    
    function updateSchedule(index, workGroup, startDate, endDate, startTime, endTime, totalHours, normalHours, overtimeHours, doubleDayApplied, doubleDayRate, normalAmount, specialAmount, doubleDayAmount, location, description, isHoliday, isDoubleDay) {
        let schedules = JSON.parse(localStorage.getItem('workSchedules')) || [];
        
        if (index >= 0 && index < schedules.length) {
            schedules[index] = {
                workGroup,  
                startDate,  
                endDate,  
                startTime,  
                endTime,  
                totalHours,  
                normalHours,  
                overtimeHours,  
                doubleDayApplied,
                doubleDayRate,
                doubleDayAmount,
                normalAmount,  
                specialAmount,  
                location,  
                description,  
                isHoliday,
                isDoubleDay,
                id: schedules[index].id // Mantener el mismo ID
            };
            
            localStorage.setItem('workSchedules', JSON.stringify(schedules));
        }
    }
    
    function editSchedule(index) {
        const schedules = JSON.parse(localStorage.getItem('workSchedules')) || [];
        
        if (index >= 0 && index < schedules.length) {
            const schedule = schedules[index];
            
            // Llenar el formulario con los datos del registro
            document.querySelector(`input[name="work-group"][value="${schedule.workGroup}"]`).checked = true;
            document.getElementById('date').value = schedule.startDate;
            document.getElementById('start-time').value = schedule.startTime;
            document.getElementById('end-date').value = schedule.endDate;
            document.getElementById('end-time').value = schedule.endTime;
            document.getElementById('location').value = schedule.location;
            document.getElementById('is-holiday').checked = schedule.isHoliday;
            document.getElementById('is-double-day').checked = schedule.isDoubleDay;
            document.getElementById('double-day-rate').value = schedule.doubleDayRate || DEFAULT_DOUBLE_DAY_RATE.toFixed(2);
            document.getElementById('description').value = schedule.description || '';
            
            // Mostrar u ocultar campos de día doble según corresponda
            if (schedule.isDoubleDay) {
                doubleDayInfo.style.display = 'block';
                doubleDayRateGroup.style.display = 'block';
            } else {
                doubleDayInfo.style.display = 'none';
                doubleDayRateGroup.style.display = 'none';
            }
            
            // Cambiar a modo edición
            isEditing = true;
            editingIndex = index;
            document.querySelector('button[type="submit"]').textContent = 'Actualizar Registro';
            
            // Scroll al formulario
            document.querySelector('.form-section').scrollIntoView({ behavior: 'smooth' });
            
            showToast('Modo edición activado. Modifica los datos y haz clic en Actualizar.', 'success');
        }
    }
    
    function cancelEdit() {
        isEditing = false;
        editingIndex = -1;
        document.querySelector('button[type="submit"]').textContent = 'Guardar y Calcular';
        
        // Limpiar formulario
        form.reset();
        
        // Establecer fechas por defecto
        const today = new Date();  
        const formattedDate = formatDateForInput(today);  
        document.getElementById('date').value = formattedDate;  
        document.getElementById('end-date').value = formattedDate;
        document.getElementById('double-day-rate').value = DEFAULT_DOUBLE_DAY_RATE.toFixed(2);
        
        // Ocultar campos de día doble
        doubleDayInfo.style.display = 'none';
        doubleDayRateGroup.style.display = 'none';
        
        showToast('Edición cancelada.', 'success');
    }
      
    function loadHistory() {  
        const schedules = JSON.parse(localStorage.getItem('workSchedules')) || [];  
          
        historyTable.innerHTML = '';  
          
        schedules.forEach((schedule, index) => {  
            addToHistoryTable(  
                index,
                schedule.workGroup,  
                schedule.startDate,  
                schedule.endDate,  
                schedule.startTime,  
                schedule.endTime,  
                schedule.totalHours,  
                schedule.normalHours,  
                schedule.overtimeHours.normal + schedule.overtimeHours.special,   
                schedule.doubleDayApplied ? 'Sí' : 'No',
                schedule.normalAmount + schedule.specialAmount + (schedule.doubleDayAmount || 0),  
                schedule.location,  
                schedule.isHoliday  
            );  
        });  
    }  
      
    function addToHistoryTable(index, workGroup, startDate, endDate, startTime, endTime, totalHours, normalHours, overtime, doubleDay, amount, location, isHoliday) {  
    const row = document.createElement('tr');  
      
    const groupName = getGroupName(workGroup);  
    const groupClass = workGroup.includes('group1') ? 'group1' : 'group2';  
      
    row.innerHTML = `  
        <td class="${groupClass}">${groupName}</td>  
        <td>${startDate}</td>  
        <td>${endDate}</td>  
        <td>${startTime}</td>  
        <td>${endTime}</td>  
        <td>${totalHours.toFixed(2)}</td>  
        <td class="regular-hours">${normalHours.toFixed(2)}</td>  
        <td style="color: ${overtime > 0 ? '#3498db' : 'inherit'}">  
            ${overtime > 0 ? overtime.toFixed(2) : '0'}  
        </td>  
        <td style="color: ${doubleDay === 'Sí' ? '#ff6b6b' : 'inherit'}">  
            ${doubleDay}  
        </td>  
        <td>Q${amount.toFixed(2)}</td>  
        <td>${location}</td>  
        <td class="no-print action-buttons">
            <button class="button-warning edit-btn" data-index="${index}">Editar</button>
            <button class="button-danger delete-btn" data-index="${index}">Eliminar</button>
        </td>  
    `;  
      
    historyTable.appendChild(row);  
      
    // Agregar evento al botón de eliminar  
    row.querySelector('.delete-btn').addEventListener('click', function() {  
        const indexToDelete = parseInt(this.getAttribute('data-index'));  
        deleteSchedule(indexToDelete);  
    });
    
    // Agregar evento al botón de editar
    row.querySelector('.edit-btn').addEventListener('click', function() {
        const indexToEdit = parseInt(this.getAttribute('data-index'));
        editSchedule(indexToEdit);
    }); 
      
    }
      
    function deleteSchedule(index) {  
        if (confirm('¿Estás seguro de que deseas eliminar este registro?')) {
            let schedules = JSON.parse(localStorage.getItem('workSchedules')) || [];  
            schedules.splice(index, 1);  
            localStorage.setItem('workSchedules', JSON.stringify(schedules));  
            loadHistory();  
            updateOvertimeSummary();
            showToast('Registro eliminado correctamente.', 'success');
            
            // Si estábamos editando este registro, cancelar edición
            if (isEditing && editingIndex === index) {
                cancelEdit();
            }
        }  
    }
    
    function clearHistory() {
        if (confirm('¿Estás seguro de que deseas eliminar todo el historial? Esta acción no se puede deshacer.')) {
            localStorage.removeItem('workSchedules');
            loadHistory();
            updateOvertimeSummary();
            showToast('Historial limpiado correctamente.', 'success');
            
            // Si estábamos editando, cancelar edición
            if (isEditing) {
                cancelEdit();
            }
        }
    }
    
    function exportToCSV() {
        const schedules = JSON.parse(localStorage.getItem('workSchedules')) || [];
        
        if (schedules.length === 0) {
            showToast('No hay datos para exportar.', 'error');
            return;
        }
        
        // Encabezados CSV
        let csvContent = "Grupo,Fecha Inicio,Fecha Fin,Hora Inicio,Hora Fin,Horas Totales,Horas Normales,Horas Extras Normales,Horas Extras Especiales,Día Doble,Monto Día Doble,Monto Extras Normales,Monto Extras Especiales,Total,Ubicación,Es Festivo,Descripción\n";
        
        // Datos
        schedules.forEach(schedule => {
            const row = [
                getGroupName(schedule.workGroup),
                schedule.startDate,
                schedule.endDate,
                schedule.startTime,
                schedule.endTime,
                schedule.totalHours,
                schedule.normalHours,
                schedule.overtimeHours.normal,
                schedule.overtimeHours.special,
                schedule.doubleDayApplied ? 'Sí' : 'No',
                schedule.doubleDayAmount || 0,
                schedule.normalAmount,
                schedule.specialAmount,
                (schedule.normalAmount + schedule.specialAmount + (schedule.doubleDayAmount || 0)).toFixed(2),
                `"${schedule.location}"`, // Entre comillas por si contiene comas
                schedule.isHoliday ? 'Sí' : 'No',
                `"${schedule.description || ''}"`
            ];
            
            csvContent += row.join(',') + '\n';
        });
        
        // Crear blob y descargar
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        const date = new Date().toISOString().slice(0, 10);
        
        link.setAttribute("href", url);
        link.setAttribute("download", `horas_extras_${date}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showToast('Datos exportados correctamente.', 'success');
    }
    
    function printResults() {
        // Actualizar la sección de impresión con los datos actuales
        document.getElementById('print-normal-hours').textContent = document.getElementById('normal-hours').textContent;
        document.getElementById('print-normal-overtime').textContent = document.getElementById('normal-overtime').textContent;
        document.getElementById('print-normal-amount').textContent = document.getElementById('normal-amount').textContent;
        document.getElementById('print-special-overtime').textContent = document.getElementById('special-overtime').textContent;
        document.getElementById('print-special-amount').textContent = document.getElementById('special-amount').textContent;
        document.getElementById('print-double-day-count').textContent = document.getElementById('double-day-count').textContent;
        document.getElementById('print-double-day-amount').textContent = document.getElementById('double-day-amount').textContent;
        document.getElementById('print-total-amount').textContent = document.getElementById('total-amount').textContent;
        
        // Establecer la fecha actual
        const now = new Date();
        const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        document.getElementById('print-date').textContent = now.toLocaleDateString('es-ES', options);
        
        // Imprimir
        window.print();
    }
    
    // FUNCIÓN CORREGIDA: Exportar a PDF
    function exportToPDF() {
        // Crear un clon del contenido a exportar
        const content = document.querySelector('.results-section').cloneNode(true);
        
        // Eliminar botones de la sección clonada
        const buttons = content.querySelector('.export-actions');
        if (buttons) {
            buttons.remove();
        }
        
        // Añadir título y fecha
        const title = document.createElement('h2');
        title.textContent = 'Resumen de Horas Extras';
        title.style.textAlign = 'center';
        title.style.marginBottom = '20px';
        title.style.color = '#2c3e50';
        
        const date = document.createElement('p');
        date.textContent = 'Generado el: ' + new Date().toLocaleDateString('es-ES', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        date.style.textAlign = 'center';
        date.style.color = '#7f8c8d';
        date.style.marginBottom = '30px';
        
        // Crear contenedor para PDF
        const pdfContainer = document.createElement('div');
        pdfContainer.appendChild(title);
        pdfContainer.appendChild(date);
        pdfContainer.appendChild(content);
        
        // Configuración para html2pdf
        const options = {
            margin: 10,
            filename: 'horas_extras.pdf',
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        
        // Generar PDF
        html2pdf().set(options).from(pdfContainer).save();
        
        showToast('PDF generado correctamente.', 'success');
    }
    
    function showToast(message, type = '') {
        toast.textContent = message;
        toast.className = 'toast';
        
        if (type) {
            toast.classList.add(type);
        }
        
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
    
    function updateRealTimePreview() {
        const workGroup = document.querySelector('input[name="work-group"]:checked')?.value;  
        const startDate = document.getElementById('date').value;  
        const startTime = document.getElementById('start-time').value;  
        let endDate = document.getElementById('end-date').value;  
        const endTime = document.getElementById('end-time').value;  
        const isHoliday = document.getElementById('is-holiday').checked;
        const isDoubleDay = document.getElementById('is-double-day').checked;
        const doubleDayRate = parseFloat(document.getElementById('double-day-rate').value) || DEFAULT_DOUBLE_DAY_RATE;
        
        // Validar que tenemos los campos necesarios
        if (!workGroup || !startDate || !startTime || !endTime) {
            return;
        }
        
        // Si no hay fecha de fin, usar la de inicio
        if (!endDate) {
            endDate = startDate;
        }
        
        try {
            // Calcular horas
            const { normalHours, overtimeHours, doubleDayApplied } = calculateHours(  
                workGroup, startDate, startTime, endDate, endTime, isHoliday, isDoubleDay  
            );
            
            // Calcular montos
            const normalAmount = overtimeHours.normal * NORMAL_OVERTIME_RATE;  
            const specialAmount = overtimeHours.special * SPECIAL_OVERTIME_RATE;  
            const doubleDayAmount = doubleDayApplied ? doubleDayRate : 0;
            const totalAmount = normalAmount + specialAmount + doubleDayAmount;
            
            // Actualizar previsualización
            document.getElementById('preview-normal').textContent = normalHours.toFixed(2);
            document.getElementById('preview-normal-ot').textContent = overtimeHours.normal.toFixed(2);
            document.getElementById('preview-special-ot').textContent = overtimeHours.special.toFixed(2);
            document.getElementById('preview-double-day').textContent = doubleDayApplied ? `Sí (Q${doubleDayAmount.toFixed(2)})` : 'No aplica';
            document.getElementById('preview-total').textContent = totalAmount.toFixed(2);
        } catch (e) {
            console.error('Error en previsualización:', e);
        }
    }
      
    function updateOvertimeSummary() {  
        const schedules = JSON.parse(localStorage.getItem('workSchedules')) || [];  
          
        let totalNormalHours = 0;  
        let normalOvertime = 0;  
