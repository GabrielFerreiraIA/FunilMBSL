import { CONFIG } from '../config';
import { Estado, fmtMoeda } from '../estado';
import { Track } from '../track';
import { ir, exigirAssinatura, link } from '../navegacao';
import { aoClicar, toast } from '../dom';
import { criarPix, guardarTransacao, cpfValido, mascaraCPF } from '../pix-client';

const ORDER_BUMP_VALOR = 4.99;

export function iniciarCheckout(): () => void {
  if (!exigirAssinatura()) return () => {};

  const lead = Estado.lead();
  const valorBase = Number(lead.valor) || CONFIG.contribuicao.valorPadrao;
  let valorTotal = valorBase;

  Track.ev('view_checkout', { valor_base: valorBase });

  const remocoes: (() => void)[] = [];

  // Elementos do DOM
  const btnVoltar = document.getElementById('checkout-btn-voltar');
  const btnFechar = document.getElementById('checkout-btn-fechar');
  const valorDisplay = document.getElementById('checkout-valor-display');
  const nomeInput = document.getElementById('checkout-nome-input') as HTMLInputElement | null;
  const anonimoCheck = document.getElementById('checkout-anonimo-checkbox') as HTMLInputElement | null;
  const whatsappInput = document.getElementById('checkout-whatsapp-input') as HTMLInputElement | null;
  const cpfCampo = document.getElementById('checkout-cpf-field');
  const cpfInput = document.getElementById('checkout-cpf-input') as HTMLInputElement | null;
  const cpfErro = document.getElementById('checkout-cpf-erro');
  const orderBumpCheck = document.getElementById('checkout-orderbump-checkbox') as HTMLInputElement | null;
  const submitBtn = document.getElementById('checkout-submit-btn') as HTMLButtonElement | null;

  // Preenche nome automaticamente do cadastro da etapa 2
  if (nomeInput && lead.nome) {
    nomeInput.value = lead.nome;
  }

  // Preenche WhatsApp se já existia
  if (whatsappInput && lead.whatsapp) {
    whatsappInput.value = lead.whatsapp;
  }

  /* O CPF é o identificador do pagador no Pix. Quando a campanha não o exige
     (CONFIG.pix.exigirCPF = false), o campo simplesmente some — o Mercado Pago
     aceita a cobrança sem ele. */
  if (cpfCampo && !CONFIG.pix.exigirCPF) {
    cpfCampo.style.display = 'none';
  }
  if (cpfInput && lead.cpf) {
    cpfInput.value = mascaraCPF(lead.cpf);
  }

  // Atualiza badge de valor contribuindo
  function atualizarValorDisplay() {
    const bumpAtivo = orderBumpCheck?.checked ?? false;
    valorTotal = valorBase + (bumpAtivo ? ORDER_BUMP_VALOR : 0);
    if (valorDisplay) {
      valorDisplay.textContent = fmtMoeda(valorTotal);
    }
  }

  atualizarValorDisplay();

  if (orderBumpCheck) {
    const onBumpChange = () => {
      atualizarValorDisplay();
      Track.ev('toggle_orderbump', { ativo: orderBumpCheck.checked, valor_total: valorTotal });
    };
    orderBumpCheck.addEventListener('change', onBumpChange);
    remocoes.push(() => orderBumpCheck.removeEventListener('change', onBumpChange));
  }

  // Mascara WhatsApp (00) 00000-0000
  if (whatsappInput) {
    const onTelInput = () => {
      let v = whatsappInput.value.replace(/\D/g, '').slice(0, 11);
      if (v.length > 10) {
        v = v.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
      } else if (v.length > 6) {
        v = v.replace(/^(\d{2})(\d{4})(\d{0,4})$/, '($1) $2-$3');
      } else if (v.length > 2) {
        v = v.replace(/^(\d{2})(\d{0,5})$/, '($1) $2');
      }
      whatsappInput.value = v;
    };
    whatsappInput.addEventListener('input', onTelInput);
    remocoes.push(() => whatsappInput.removeEventListener('input', onTelInput));
  }

  // Mascara e valida CPF
  if (cpfInput) {
    const onCpfInput = () => {
      cpfInput.value = mascaraCPF(cpfInput.value);
      if (cpfErro) cpfErro.style.display = 'none';
    };
    cpfInput.addEventListener('input', onCpfInput);
    remocoes.push(() => cpfInput.removeEventListener('input', onCpfInput));
  }

  // Ação de Voltar
  if (btnVoltar) {
    remocoes.push(aoClicar(btnVoltar, () => ir('pagamento')));
  }
  if (btnFechar) {
    remocoes.push(aoClicar(btnFechar, () => ir('pagamento')));
  }

  /* -- Gerar a cobrança ------------------------------------------------------
     Aqui só criamos o Pix e mandamos a pessoa para /pix. A tela de pagamento
     (QR, copia e cola, cronômetro e confirmação) é uma página própria: assim
     ela sobrevive a um recarregamento e não fica presa ao layout deste modal. */
  async function gerarPix() {
    const nomeFinal = (nomeInput?.value ?? lead.nome ?? '').trim();
    const whatsapp = (whatsappInput?.value ?? '').trim();
    const anonimo = anonimoCheck?.checked ?? false;
    const orderBump = orderBumpCheck?.checked ?? false;
    const cpf = (cpfInput?.value ?? lead.cpf ?? '').replace(/\D/g, '');

    if (!nomeFinal) {
      toast('Por favor, informe seu nome.');
      nomeInput?.focus();
      return;
    }

    if (CONFIG.pix.exigirCPF && !cpfValido(cpf)) {
      if (cpfErro) cpfErro.style.display = 'block';
      toast('Informe um CPF válido para gerar o Pix.');
      cpfInput?.focus();
      return;
    }

    Estado.salvar({
      nome: nomeFinal,
      whatsapp,
      anonimo,
      orderBump,
      cpf: cpf || null,
      valor: valorTotal
    });

    const rotuloOriginal = submitBtn?.textContent ?? 'Gerar Pix agora';
    if (submitBtn) {
      submitBtn.textContent = 'Gerando Pix...';
      submitBtn.style.pointerEvents = 'none';
      submitBtn.style.opacity = '.75';
    }

    try {
      const tx = await criarPix(
        {
          valor: valorTotal,
          // O "anônimo" vale para a vitrine de doadores da campanha; a cobrança
          // segue com o nome real, que é o que o banco confere no Pix.
          nome: nomeFinal,
          email: lead.email,
          cpf: cpf || null
        },
        CONFIG.campanha.id,
        Estado.utms()
      );

      Estado.salvar({ transacaoId: tx.id });
      guardarTransacao(tx, valorTotal);
      Track.ev('pix_gerado', { valor: valorTotal, transacao_id: tx.id, simulado: tx.simulado });

      window.location.href = link('/pix');
    } catch (erro) {
      if (submitBtn) {
        submitBtn.textContent = rotuloOriginal;
        submitBtn.style.pointerEvents = '';
        submitBtn.style.opacity = '';
      }
      toast('Não foi possível gerar o Pix. Tente novamente.');
      console.error(erro);
    }
  }

  if (submitBtn) {
    remocoes.push(aoClicar(submitBtn, gerarPix));
  }

  return () => {
    remocoes.forEach((f) => f());
  };
}
