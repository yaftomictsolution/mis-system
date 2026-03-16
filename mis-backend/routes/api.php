<?php

use App\Http\Controllers\Api\ApprovalController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CustomerController;
use App\Http\Controllers\Api\UserRoleController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\ApartmentController;
use App\Http\Controllers\Api\EmployeeController;
use App\Http\Controllers\Api\ApartmentSaleController;
use App\Http\Controllers\Api\InstallmentController;
use App\Http\Controllers\Api\MunicipalityWorkflowController;
use App\Http\Controllers\Api\CrmMessageController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\OfflinePolicyController;
use App\Http\Controllers\Api\ApartmentRentalController;
use App\Http\Controllers\Api\DocumentController;
use App\Http\Controllers\Api\SyncController;
use Illuminate\Support\Facades\Route;

Route::post('/auth/login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {
    
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::put('/auth/profile', [AuthController::class, 'updateProfile']);
    Route::put('/auth/password', [AuthController::class, 'updatePassword']);
    Route::get('/settings/offline-policy', [OfflinePolicyController::class, 'show']);
    Route::put('/settings/offline-policy', [OfflinePolicyController::class, 'update']);

    Route::get('/approvals', [ApprovalController::class, 'index']);
    Route::post('/approvals/{approval}/approve', [ApprovalController::class, 'approve']);
    Route::post('/approvals/{approval}/reject', [ApprovalController::class, 'reject']);

    Route::get('/customers', [CustomerController::class, 'index']);
    Route::post('/customers', [CustomerController::class, 'store']);
    Route::put('/customers/{uuid}', [CustomerController::class, 'update']);
    Route::delete('/customers/{uuid}', [CustomerController::class, 'destroy']);
    Route::post('/customers/{uuid}/attachments', [CustomerController::class, 'storeAttachmentOnly']);
    //
    Route::get('/roles/permission-options', [UserRoleController::class, 'permissionOptions']);
    Route::get('/roles', [UserRoleController::class, 'index']);
    Route::post('/roles', [UserRoleController::class, 'store']);
    Route::put('/roles/{uuid}', [UserRoleController::class, 'update']);
    Route::delete('/roles/{uuid}', [UserRoleController::class, 'destroy']);
    // 
    Route::get('/users', [UserController::class, 'index']);
    Route::post('/users', [UserController::class, 'store']);
    Route::put('/users/{uuid}', [UserController::class, 'update']);
    Route::delete('/users/{uuid}', [UserController::class, 'destroy']);
    Route::get('/users/role-options', [UserController::class, 'roleOptions']);
    //
    Route::get('/apartments', [ApartmentController::class, 'index']);
    Route::get('/employees', [EmployeeController::class, 'index']);
    Route::post('/employees', [EmployeeController::class, 'store']);

    Route::post('/apartments', [ApartmentController::class, 'store']);
    Route::put('/apartments/{uuid}', [ApartmentController::class, 'update']);
    Route::delete('/apartments/{uuid}', [ApartmentController::class, 'destroy']);
    //

    Route::get('/apartment-sales', [ApartmentSaleController::class, 'index']);
    Route::post('/apartment-sales', [ApartmentSaleController::class, 'store']);
    Route::put('/apartment-sales/{uuid}', [ApartmentSaleController::class, 'update']);
    Route::delete('/apartment-sales/{uuid}', [ApartmentSaleController::class, 'destroy']);
    Route::post('/apartment-sales/{uuid}/handover-key', [ApartmentSaleController::class, 'handoverKey']);
    Route::post('/apartment-sales/{uuid}/terminate', [ApartmentSaleController::class, 'terminate']);
    Route::post('/apartment-sales/{uuid}/issue-deed', [ApartmentSaleController::class, 'issueDeed']);
    Route::get('/apartment-sales/{uuid}/installment-payments', [ApartmentSaleController::class, 'installmentPayments']);
    Route::get('/apartment-sales/{uuid}/possession-logs', [ApartmentSaleController::class, 'possessionLogs']);
    Route::get('/apartment-sales/{uuid}/municipality-letter', [MunicipalityWorkflowController::class, 'showLetter']);
    Route::post('/apartment-sales/{uuid}/municipality-letter', [MunicipalityWorkflowController::class, 'generateLetter']);
    Route::get('/apartment-sales/{uuid}/municipality-receipts', [MunicipalityWorkflowController::class, 'receiptList']);
    Route::post('/apartment-sales/{uuid}/municipality-receipts', [MunicipalityWorkflowController::class, 'storeReceipt']);
    Route::get('/installments', [InstallmentController::class, 'index']);
    Route::post('/installments/{uuid}/pay', [InstallmentController::class, 'pay']);
    Route::get('/rentals', [ApartmentRentalController::class, 'index']);
    Route::post('/rentals', [ApartmentRentalController::class, 'store']);
    Route::put('/rentals/{uuid}', [ApartmentRentalController::class, 'update']);
    Route::delete('/rentals/{uuid}', [ApartmentRentalController::class, 'destroy']);
    Route::post('/rentals/{uuid}/bills', [ApartmentRentalController::class, 'generateBill']);
    Route::post('/rentals/{uuid}/payments', [ApartmentRentalController::class, 'addPayment']);
    Route::post('/rentals/{uuid}/handover-key', [ApartmentRentalController::class, 'handoverKey']);
    Route::post('/rentals/{uuid}/close', [ApartmentRentalController::class, 'close']);
    Route::get('/rental-payments', [ApartmentRentalController::class, 'paymentsIndex']);
    Route::post('/rental-payments/{uuid}/approve', [ApartmentRentalController::class, 'approvePayment']);
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead']);
    Route::post('/notifications/{id}/read', [NotificationController::class, 'markRead']);
    Route::get('/crm/messages', [CrmMessageController::class, 'index']);
    Route::post('/crm/messages', [CrmMessageController::class, 'store']);
    Route::post('/crm/messages/{id}/retry', [CrmMessageController::class, 'retry']);
    Route::post('/crm/reminders/run', [CrmMessageController::class, 'runInstallmentReminders']);
    Route::get('/documents', [DocumentController::class, 'index']);
    Route::get('/documents/reference-options', [DocumentController::class, 'referenceOptions']);
    Route::post('/documents', [DocumentController::class, 'store']);
    Route::delete('/documents/{id}', [DocumentController::class, 'destroy']);
    // sync
    Route::post('/sync/push', [SyncController::class, 'push']);
    Route::get('/sync/pull', [SyncController::class, 'pull']);

});


