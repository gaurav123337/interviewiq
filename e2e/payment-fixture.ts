/* A deliberately small payment-provider double, served instead of the remote
   SDK. It draws its own controls and invokes the documented callbacks only.
   No app entitlement/state is changed by this script; pay-verify handles that. */
export const PAYMENT_FIXTURE_SCRIPT = `
window.Razorpay = class {
  constructor(options) { this.options = options; }
  open() {
    const panel = document.createElement('section');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Synthetic payment provider');
    Object.assign(panel.style, {position:'fixed',inset:'15%',zIndex:'99999',background:'#fff',color:'#111',padding:'24px',border:'3px solid #555'});
    const title = document.createElement('h2'); title.textContent = 'Synthetic checkout — no money is charged'; panel.append(title);
    const pay = document.createElement('button'); pay.textContent = 'Complete synthetic payment';
    pay.onclick = () => { panel.remove(); this.options.handler({razorpay_payment_id:'virtual-payment',razorpay_order_id:this.options.order_id,razorpay_signature:'synthetic-not-a-signature'}); };
    const cancel = document.createElement('button'); cancel.textContent = 'Cancel synthetic payment';
    cancel.onclick = () => { panel.remove(); this.options.modal.ondismiss(); };
    panel.append(pay, cancel); document.body.append(panel);
  }
};
`;
