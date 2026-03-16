<?php

namespace App\Services;

use App\Models\ApartmentSale;
use App\Models\ApartmentSaleFinancial;
use App\Models\MunicipalityPaymentLetter;
use App\Models\MunicipalityReceipt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class MunicipalityWorkflowService
{
    public function __construct(private readonly ApartmentSaleFinancialService $financials)
    {
    }

    public function ensurePaymentLetter(ApartmentSale $sale, ApartmentSaleFinancial $financial): MunicipalityPaymentLetter
    {
        $letter = MunicipalityPaymentLetter::query()
            ->firstOrNew(['apartment_sale_id' => $sale->id]);

        if (!$letter->exists) {
            $letter->uuid = (string) Str::uuid();
            $letter->letter_no = $this->generateLetterNo($sale);
            $letter->issued_at = now();
        }

        $letter->municipality_share_amount = $this->toMoney($financial->municipality_share_15);
        $letter->remaining_municipality = $this->toMoney($financial->remaining_municipality);
        $letter->save();

        return $letter;
    }

    public function recordReceipt(ApartmentSale $sale, array $input, ?int $receivedBy = null): array
    {
        return DB::transaction(function () use ($sale, $input, $receivedBy): array {
            $freshSale = $sale->fresh();
            if (!$freshSale) {
                throw ValidationException::withMessages([
                    'sale' => 'Apartment sale not found.',
                ]);
            }

            $financial = $this->financials->recalculateForSale($freshSale);
            $remaining = $this->toMoney($financial->remaining_municipality);
            if ($remaining <= 0) {
                throw ValidationException::withMessages([
                    'amount' => 'Municipality share is already settled for this sale.',
                ]);
            }

            $amount = $this->toMoney($input['amount'] ?? 0);
            if ($amount <= 0) {
                throw ValidationException::withMessages([
                    'amount' => 'Amount must be greater than 0.',
                ]);
            }

            if ($amount > $remaining) {
                throw ValidationException::withMessages([
                    'amount' => 'Amount cannot exceed remaining municipality share.',
                ]);
            }

            $receiptNo = trim((string) ($input['receipt_no'] ?? ''));
            if ($receiptNo === '') {
                $receiptNo = $this->generateReceiptNo($freshSale);
            }

            $receipt = MunicipalityReceipt::query()->create([
                'uuid' => (string) Str::uuid(),
                'apartment_sale_id' => $freshSale->id,
                'receipt_no' => mb_substr($receiptNo, 0, 50),
                'payment_date' => (string) ($input['payment_date'] ?? now()->toDateString()),
                'amount' => $amount,
                'payment_method' => mb_substr(trim((string) ($input['payment_method'] ?? 'cash')) ?: 'cash', 0, 30),
                'notes' => isset($input['notes']) ? (string) $input['notes'] : null,
                'received_by' => $receivedBy,
            ]);

            $updatedFinancial = $this->financials->recalculateForSale($freshSale->fresh(), [
                'delivered_to_municipality' => $this->toMoney($financial->delivered_to_municipality) + $amount,
            ]);

            $letter = $this->ensurePaymentLetter($freshSale->fresh(), $updatedFinancial);

            return [
                'receipt' => $receipt,
                'financial' => $updatedFinancial,
                'letter' => $letter,
            ];
        });
    }

    public function letterPayload(ApartmentSale $sale, ApartmentSaleFinancial $financial, MunicipalityPaymentLetter $letter): array
    {
        $saleId = trim((string) ($sale->sale_id ?? ''));
        $saleLabel = $saleId !== '' ? $saleId : (string) $sale->uuid;
        $customerName = trim((string) ($sale->customer?->name ?? ''));
        $apartmentCode = trim((string) ($sale->apartment?->apartment_code ?? ''));

        $issuedAt = $letter->issued_at ? $letter->issued_at->format('Y-m-d H:i:s') : now()->format('Y-m-d H:i:s');
        $municipalityShare = $this->toMoney($financial->municipality_share_15);
        $remaining = $this->toMoney($financial->remaining_municipality);
        $delivered = $this->toMoney($financial->delivered_to_municipality);

        $html = '<!doctype html><html><head><meta charset="utf-8"><title>Municipality Payment Letter</title>'
            . '<style>'
            . 'body{font-family:Arial,sans-serif;margin:32px;color:#111827;}'
            . 'h1{margin:0 0 6px 0;font-size:24px;}'
            . '.muted{color:#6b7280;font-size:12px;}'
            . 'table{width:100%;border-collapse:collapse;margin-top:18px;}'
            . 'td,th{border:1px solid #d1d5db;padding:10px;text-align:left;font-size:14px;}'
            . '.amount{font-weight:700;font-size:16px;}'
            . '.footer{margin-top:28px;font-size:12px;color:#4b5563;}'
            . '</style></head><body>'
            . '<h1>Municipality Share Payment Letter</h1>'
            . '<div class="muted">Letter No: ' . e($letter->letter_no) . ' | Issued At: ' . e($issuedAt) . '</div>'
            . '<table><tbody>'
            . '<tr><th>Sale ID</th><td>' . e($saleLabel) . '</td></tr>'
            . '<tr><th>Customer</th><td>' . e($customerName !== '' ? $customerName : ('Customer #' . $sale->customer_id)) . '</td></tr>'
            . '<tr><th>Apartment</th><td>' . e($apartmentCode !== '' ? $apartmentCode : ('Apartment #' . $sale->apartment_id)) . '</td></tr>'
            . '<tr><th>Municipality Share (15%)</th><td class="amount">$' . number_format($municipalityShare, 2) . '</td></tr>'
            . '<tr><th>Delivered to Municipality</th><td>$' . number_format($delivered, 2) . '</td></tr>'
            . '<tr><th>Remaining Municipality</th><td class="amount">$' . number_format($remaining, 2) . '</td></tr>'
            . '</tbody></table>'
            . '<div class="footer">Generated by MIS Municipality Workflow</div>'
            . '</body></html>';

        return [
            'uuid' => $letter->uuid,
            'letter_no' => $letter->letter_no,
            'issued_at' => $letter->issued_at?->toISOString(),
            'apartment_sale_id' => $letter->apartment_sale_id,
            'sale_uuid' => $sale->uuid,
            'municipality_share_amount' => $municipalityShare,
            'remaining_municipality' => $remaining,
            'printable_html' => $html,
        ];
    }

    private function generateLetterNo(ApartmentSale $sale): string
    {
        $base = trim((string) ($sale->sale_id ?? ''));
        if ($base !== '') {
            $candidate = 'MUN-' . $base;
            $exists = MunicipalityPaymentLetter::query()
                ->where('letter_no', $candidate)
                ->where('apartment_sale_id', '!=', $sale->id)
                ->exists();
            if (!$exists) {
                return $candidate;
            }
        }

        return 'MUN-' . now()->format('Ymd') . '-' . str_pad((string) (MunicipalityPaymentLetter::max('id') + 1), 6, '0', STR_PAD_LEFT);
    }

    private function generateReceiptNo(ApartmentSale $sale): string
    {
        $base = trim((string) ($sale->sale_id ?? 'SALE'));
        $counter = MunicipalityReceipt::query()
            ->where('apartment_sale_id', $sale->id)
            ->count() + 1;

        return 'MRC-' . $base . '-' . str_pad((string) $counter, 3, '0', STR_PAD_LEFT);
    }

    private function toMoney($value): float
    {
        $n = (float) $value;
        if (!is_finite($n) || $n < 0) {
            return 0.0;
        }
        return round($n, 2);
    }
}

