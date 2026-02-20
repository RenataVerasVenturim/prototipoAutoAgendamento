
/* ===========================
   Variáveis globais
=========================== */
const textarea = document.getElementById('obs');
const contador = document.getElementById('contador');
const max = textarea.getAttribute('maxlength');

textarea.addEventListener('input', () => {
  contador.textContent = `${textarea.value.length} / ${max} caracteres`;
});

const dataInput = document.getElementById("data");
const horaSelect = document.getElementById("hora");
const duracaoInput = document.getElementById("duracao");

let diasPermitidos = [];
let feriados = [];
let diasSemHorario = []; 
let fpCalendario;


/* ===========================
   Carregar horários disponíveis
=========================== */
function carregarHorariosDisponiveis(dataSelecionada) {
  horaSelect.disabled = true;
  horaSelect.innerHTML = '<option value="">Carregando horários...</option>';

  google.script.run.withSuccessHandler(function(resultado) {
    const divMsgHor = document.getElementById("mensagemHorarios");

    if (!resultado || !resultado.horarios || resultado.horarios.length === 0) {
      horaSelect.innerHTML = '<option value="">Nenhum horário disponível</option>';
      divMsgHor.style.display = "block";
      divMsgHor.innerHTML = "<p><b>Todos os horários estão ocupados nessa data.</b></p>";
      horaSelect.disabled = true;
      return;
    }

    horaSelect.innerHTML = resultado.horarios
      .map(h => `<option value="${h}">${h}</option>`)
      .join("");
    divMsgHor.style.display = "none";
    horaSelect.disabled = false;
    duracaoInput.value = resultado.duracao;
  }).getHorariosDisponiveis(dataSelecionada);
}
/*Array de dias sem horários disponíveis*/
function atualizarDiasSemHorario(dataStr) {
  google.script.run.withSuccessHandler(function(resultado) {
    if (!resultado || !resultado.horarios || resultado.horarios.length === 0) {
      diasSemHorario.push(dataStr); // bloqueia dia
      fpCalendario.redraw();        // redesenha calendário
    }
  }).getHorariosDisponiveis(dataStr);
}
// Função que retorna uma Promise para verificar se há horários
function verificarDiaSemHorario(dataStr) {
  return new Promise((resolve) => {
    google.script.run.withSuccessHandler(function(resultado) {
      if (!resultado || !resultado.horarios || resultado.horarios.length === 0) {
        diasSemHorario.push(dataStr); // bloqueia dia
      }
      resolve();
    }).getHorariosDisponiveis(dataStr);
  });
}

/* ===========================
   Inicialização DOM
=========================== */


document.addEventListener("DOMContentLoaded", function() {


  // Função que retorna uma Promise para verificar se há horários
  function verificarDiaSemHorario(dataStr) {
    return new Promise((resolve) => {
      google.script.run.withSuccessHandler(function(resultado) {
        if (!resultado || !resultado.horarios || resultado.horarios.length === 0) {
          diasSemHorario.push(dataStr);
        }
        resolve();
      }).getHorariosDisponiveis(dataStr);
    });
  }

  // Busca feriados
  google.script.run.withSuccessHandler(function(listaFeriados) {
    feriados = listaFeriados || [];

    // Busca dias permitidos
    google.script.run.withSuccessHandler(async function(dias) {
      diasPermitidos = dias;

      // Verifica os próximos 60 dias
      const hoje = new Date();
      const promises = [];
      for (let i = 0; i < 60; i++) {
        const d = new Date(hoje);
        d.setDate(d.getDate() + i);
        const iso = d.toISOString().split('T')[0];
        promises.push(verificarDiaSemHorario(iso));
      }

      // Aguarda todas as verificações
      await Promise.all(promises);

      fpCalendario = flatpickr("#data", {
      dateFormat: "Y-m-d",
      minDate: new Date().fp_incr(2), // não permite datas anteriores a hoje()+2
      maxDate: new Date().fp_incr(60), // permite até 60 dias à frente
      disable: [
        function(date) {
          const iso = date.toISOString().split('T')[0];
          return !diasPermitidos.includes(date.getDay()) || feriados.includes(iso) || diasSemHorario.includes(iso);
        }
      ],
      onDayCreate: function(dObj, dStr, fp, dayElem) {
        const iso = dayElem.dateObj.toISOString().split('T')[0];
        if (diasPermitidos.includes(dayElem.dateObj.getDay()) && !feriados.includes(iso) && !diasSemHorario.includes(iso)) {
          dayElem.classList.add('dia-disponivel');
        }
        if (dayElem.classList.contains("flatpickr-disabled")) {
          dayElem.style.backgroundColor = "#eee";
          dayElem.style.color = "#999";
          dayElem.style.cursor = "not-allowed";
        }
      },
      onChange: function(selectedDates, dateStr) {
        if (!dateStr) return;
        carregarHorariosDisponiveis(dateStr);
      }
    });

  
    dataInput.placeholder = "Escolha uma data";
    }).getDiasPermitidos();

  }).getConfigPlanilha("Config_Feriados");

});


/* ===========================
   Submit do formulário
=========================== */
document.getElementById("formAgendamento").addEventListener("submit", function(e) {
  e.preventDefault();

  const btn = document.querySelector("#formAgendamento button[type=submit]");
  const textoOriginal = btn.textContent;

  // Alterar estilo e texto do botão
  btn.textContent = "Processando...";
  btn.disabled = true;
  btn.style.opacity = "0.7";
  btn.style.cursor = "not-allowed";

  // Captura os dados do formulário

  const dados = {
    nome: document.getElementById("nome").value.trim(),
    unidade: document.getElementById("unidade").value.trim(),
    processo: document.getElementById("Processo").value.trim(),
    email: document.getElementById("email").value.trim(),
    data: document.getElementById("data").value,
    hora: document.getElementById("hora").value,
    duracao: document.getElementById("duracao").value,
    obs: document.getElementById("obs").value,
    consentimento: document.getElementById("aceite").checked,
    dataConsentimento: new Date().toISOString() 
  };
      google.script.run
        .withSuccessHandler(res => {
            document.getElementById("mensagemAgendamento").innerHTML = res.mensagem;
            document.getElementById("mensagemAgendamento").style.display = "block";
        })
        .processarAgendamento(dados);



  // Validação do e-mail institucional
  const regexUFF = /^[a-zA-Z0-9._%+-]+@ID\.UFF\.BR$/;
  if (!regexUFF.test(dados.email)) {
    alert("Apenas e-mails do domínio @id.uff.br são permitidos.");
    restaurarBotao();
    return;
  }

  // Validação do nome
  if (!dados.nome || dados.nome.length < 3) {
    alert("Nome inválido. Digite pelo menos 3 caracteres.");
    restaurarBotao();
    return;
  }
  // Validação do processo
  const regexProcesso = /^(23069\.\d{6}\/\d{4}-\d{2})?$/;

  if (!regexProcesso.test(dados.processo)) {
  alert("Informe um número de processo válido (formato: 23069.xxxxxx/YYYY-xx).");
  restaurarBotao();
  return;
  }


  // Validação da data
  const regexData = /^\d{4}-\d{2}-\d{2}$/;
  if (!regexData.test(dados.data)) {
    alert("Data inválida. Selecione uma data válida (formato: YYYY-MM-DD).");
    restaurarBotao();
    return;
  }

  // Envia os dados para o Google Apps Script
  google.script.run
    .withSuccessHandler(function(resposta) {
      const divMsgAg = document.getElementById("mensagemAgendamento");
      divMsgAg.style.display = "block";

      if (!resposta.sucesso) {
        divMsgAg.style.color = "red";
        divMsgAg.innerHTML = `<p><b>${resposta.mensagem}</b></p>`;
        restaurarBotao();
        return;
      }

      divMsgAg.style.color = "green";
      divMsgAg.innerHTML = `<p>${resposta.mensagem}</p>`;
      restaurarBotao();
    })
    .withFailureHandler(function(erro) {
      alert("Erro no agendamento: " + erro.message);
      restaurarBotao();
    })
    .processarAgendamento(dados);

  function restaurarBotao() {
    btn.textContent = textoOriginal;
    btn.disabled = false;
    btn.style.opacity = "1";
    btn.style.cursor = "pointer";
  }
});

/* ===========================
   Recuperar Calendar ID
=========================== */
google.script.run.withSuccessHandler(function(calendarId) {
  window.CALENDAR_ID = calendarId; // salvar para usar em outros scripts
}).getCalendarId();


