import type { NextRequest } from 'next/server';
import Stripe from 'stripe';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { customerId, priceId, promotionCode, customerDetails } = (await req.json()) as {
      customerId?: string;
      priceId?: string;
      promotionCode?: string;
      customerDetails?: {
        name?: string;
        email?: string;
        address?: { line1?: string; line2?: string; city?: string; state?: string; postal_code?: string; country?: string };
      };
    };
    if (!customerId || !priceId) {
      return new Response(JSON.stringify({ error: 'Missing customerId or priceId' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) return new Response(JSON.stringify({ error: 'STRIPE_SECRET_KEY not configured' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    const stripe = new Stripe(secret);

    const normAddress = (a?: { line1?: string; line2?: string; city?: string; state?: string; postal_code?: string; country?: string } | null) => {
      if (!a) return undefined;
      const line1 = (a.line1 || '').trim();
      const line2 = (a.line2 || '').trim();
      if (!line1 && line2) return { ...a, line1: line2, line2: undefined };
      return a;
    };

    let discountInput: { coupon?: string }[] | undefined = undefined;
    if (promotionCode && promotionCode.trim()) {
      const promos = await stripe.promotionCodes.list({ code: promotionCode.trim(), active: true, limit: 1 });
      const pc = promos.data[0];
      if (pc?.coupon) discountInput = [{ coupon: pc.coupon.id }];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const invoicesAny: any = stripe.invoices as any;
    const upcoming = await invoicesAny.retrieveUpcoming({
      customer: customerId,
      subscription_items: [{ price: priceId, quantity: 1 }],
      discounts: discountInput,
      automatic_tax: { enabled: true },
      customer_details: customerDetails ? {
        name: customerDetails.name,
        email: customerDetails.email,
        address: normAddress(customerDetails.address),
      } : undefined,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const upcomingAny = upcoming as any;
    const discountTotal = Array.isArray(upcomingAny.total_discount_amounts)
      ? (upcomingAny.total_discount_amounts as Array<{ amount?: number }>).reduce((sum: number, d) => sum + (d.amount || 0), 0)
      : (upcoming.discount ? (upcoming.total ? (upcoming.subtotal || 0) - upcoming.total + (upcoming.tax || 0) : 0) : 0);

    const firstLine = upcoming.lines?.data?.[0];
    const lineDesc = firstLine?.description || firstLine?.price?.nickname || undefined;

    return new Response(JSON.stringify({
      subtotal: upcoming.subtotal,
      tax: upcoming.tax,
      total: upcoming.total,
      discount: discountTotal,
      currency: upcoming.currency,
      lineDescription: lineDesc,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
