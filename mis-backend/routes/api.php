<?php

use App\Http\Controllers\Api\ApprovalController;
use App\Http\Controllers\Api\AssetRequestController;
use App\Http\Controllers\Api\ApartmentController;
use App\Http\Controllers\Api\ApartmentRentalController;
use App\Http\Controllers\Api\ApartmentSaleController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CompanyAssetController;
use App\Http\Controllers\Api\CrmMessageController;
use App\Http\Controllers\Api\CustomerController;
use App\Http\Controllers\Api\DashboardSummaryController;
use App\Http\Controllers\Api\DocumentController;
use App\Http\Controllers\Api\EmployeeController;
use App\Http\Controllers\Api\InstallmentController;
use App\Http\Controllers\Api\MaterialController;
use App\Http\Controllers\Api\MaterialRequestController;
use App\Http\Controllers\Api\MunicipalityWorkflowController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\OfflinePolicyController;
use App\Http\Controllers\Api\ProjectMaterialStockController;
use App\Http\Controllers\Api\ProjectController;
use App\Http\Controllers\Api\PurchaseRequestController;
use App\Http\Controllers\Api\SalaryAdvanceController;
use App\Http\Controllers\Api\SalaryPaymentController;
use App\Http\Controllers\Api\StockMovementController;
use App\Http\Controllers\Api\SyncController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\UserRoleController;
use App\Http\Controllers\Api\VendorController;
use App\Http\Controllers\Api\WarehouseController;
use App\Http\Controllers\Api\WarehouseMaterialStockController;
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
    Route::get('/dashboard/summary', [DashboardSummaryController::class, 'show']);

    Route::get('/customers', [CustomerController::class, 'index']);
    Route::post('/customers', [CustomerController::class, 'store']);
    Route::put('/customers/{uuid}', [CustomerController::class, 'update']);
    Route::delete('/customers/{uuid}', [CustomerController::class, 'destroy']);
    Route::delete('/customers/{uuid}/force', [CustomerController::class, 'forceDestroy']);
    Route::post('/customers/{uuid}/attachments', [CustomerController::class, 'storeAttachmentOnly']);

    Route::get('/roles/permission-options', [UserRoleController::class, 'permissionOptions']);
    Route::get('/roles', [UserRoleController::class, 'index']);
    Route::post('/roles', [UserRoleController::class, 'store']);
    Route::put('/roles/{uuid}', [UserRoleController::class, 'update']);
    Route::delete('/roles/{uuid}', [UserRoleController::class, 'destroy']);
    Route::delete('/roles/{uuid}/force', [UserRoleController::class, 'forceDestroy']);

    Route::get('/users', [UserController::class, 'index']);
    Route::post('/users', [UserController::class, 'store']);
    Route::put('/users/{uuid}', [UserController::class, 'update']);
    Route::delete('/users/{uuid}', [UserController::class, 'destroy']);
    Route::delete('/users/{uuid}/force', [UserController::class, 'forceDestroy']);
    Route::get('/users/role-options', [UserController::class, 'roleOptions']);

    Route::get('/apartments', [ApartmentController::class, 'index']);
    Route::post('/apartments', [ApartmentController::class, 'store']);
    Route::put('/apartments/{uuid}', [ApartmentController::class, 'update']);
    Route::delete('/apartments/{uuid}', [ApartmentController::class, 'destroy']);
    Route::delete('/apartments/{uuid}/force', [ApartmentController::class, 'forceDestroy']);

    Route::get('/employees', [EmployeeController::class, 'index']);
    Route::post('/employees', [EmployeeController::class, 'store']);
    Route::put('/employees/{uuid}', [EmployeeController::class, 'update']);
    Route::delete('/employees/{uuid}', [EmployeeController::class, 'destroy']);
    Route::delete('/employees/{uuid}/force', [EmployeeController::class, 'forceDestroy']);

    Route::get('/salary-advances', [SalaryAdvanceController::class, 'index']);
    Route::post('/salary-advances', [SalaryAdvanceController::class, 'store']);
    Route::put('/salary-advances/{uuid}', [SalaryAdvanceController::class, 'update']);
    Route::delete('/salary-advances/{uuid}', [SalaryAdvanceController::class, 'destroy']);
    Route::delete('/salary-advances/{uuid}/force', [SalaryAdvanceController::class, 'forceDestroy']);

    Route::get('/salary-payments', [SalaryPaymentController::class, 'index']);
    Route::post('/salary-payments', [SalaryPaymentController::class, 'store']);
    Route::put('/salary-payments/{uuid}', [SalaryPaymentController::class, 'update']);
    Route::delete('/salary-payments/{uuid}', [SalaryPaymentController::class, 'destroy']);
    Route::delete('/salary-payments/{uuid}/force', [SalaryPaymentController::class, 'forceDestroy']);

    Route::get('/projects', [ProjectController::class, 'index']);
    Route::post('/projects', [ProjectController::class, 'store']);
    Route::put('/projects/{uuid}', [ProjectController::class, 'update']);
    Route::delete('/projects/{uuid}', [ProjectController::class, 'destroy']);
    Route::delete('/projects/{uuid}/force', [ProjectController::class, 'forceDestroy']);

    Route::get('/vendors', [VendorController::class, 'index']);
    Route::post('/vendors', [VendorController::class, 'store']);
    Route::put('/vendors/{uuid}', [VendorController::class, 'update']);
    Route::delete('/vendors/{uuid}', [VendorController::class, 'destroy']);
    Route::delete('/vendors/{uuid}/force', [VendorController::class, 'forceDestroy']);

    Route::get('/warehouses', [WarehouseController::class, 'index']);
    Route::post('/warehouses', [WarehouseController::class, 'store']);
    Route::put('/warehouses/{uuid}', [WarehouseController::class, 'update']);
    Route::delete('/warehouses/{uuid}', [WarehouseController::class, 'destroy']);
    Route::delete('/warehouses/{uuid}/force', [WarehouseController::class, 'forceDestroy']);

    Route::get('/materials', [MaterialController::class, 'index']);
    Route::post('/materials', [MaterialController::class, 'store']);
    Route::put('/materials/{uuid}', [MaterialController::class, 'update']);
    Route::delete('/materials/{uuid}', [MaterialController::class, 'destroy']);
    Route::delete('/materials/{uuid}/force', [MaterialController::class, 'forceDestroy']);
    Route::post('/materials/{uuid}/assign-stock', [MaterialController::class, 'assignLegacyStock']);

    Route::get('/company-assets', [CompanyAssetController::class, 'index']);
    Route::post('/company-assets', [CompanyAssetController::class, 'store']);
    Route::put('/company-assets/{uuid}', [CompanyAssetController::class, 'update']);
    Route::delete('/company-assets/{uuid}', [CompanyAssetController::class, 'destroy']);
    Route::delete('/company-assets/{uuid}/force', [CompanyAssetController::class, 'forceDestroy']);

    Route::get('/material-requests', [MaterialRequestController::class, 'index']);
    Route::post('/material-requests', [MaterialRequestController::class, 'store']);
    Route::put('/material-requests/{uuid}', [MaterialRequestController::class, 'update']);
    Route::delete('/material-requests/{uuid}', [MaterialRequestController::class, 'destroy']);
    Route::delete('/material-requests/{uuid}/force', [MaterialRequestController::class, 'forceDestroy']);
    Route::post('/material-requests/{uuid}/approve', [MaterialRequestController::class, 'approve']);
    Route::post('/material-requests/{uuid}/reject', [MaterialRequestController::class, 'reject']);
    Route::post('/material-requests/{uuid}/issue', [MaterialRequestController::class, 'issue']);

    Route::get('/purchase-requests', [PurchaseRequestController::class, 'index']);
    Route::post('/purchase-requests', [PurchaseRequestController::class, 'store']);
    Route::put('/purchase-requests/{uuid}', [PurchaseRequestController::class, 'update']);
    Route::delete('/purchase-requests/{uuid}', [PurchaseRequestController::class, 'destroy']);
    Route::delete('/purchase-requests/{uuid}/force', [PurchaseRequestController::class, 'forceDestroy']);
    Route::post('/purchase-requests/{uuid}/approve', [PurchaseRequestController::class, 'approve']);
    Route::post('/purchase-requests/{uuid}/reject', [PurchaseRequestController::class, 'reject']);
    Route::post('/purchase-requests/{uuid}/receive', [PurchaseRequestController::class, 'receive']);

    Route::get('/asset-requests', [AssetRequestController::class, 'index']);
    Route::post('/asset-requests', [AssetRequestController::class, 'store']);
    Route::put('/asset-requests/{uuid}', [AssetRequestController::class, 'update']);
    Route::delete('/asset-requests/{uuid}', [AssetRequestController::class, 'destroy']);
    Route::delete('/asset-requests/{uuid}/force', [AssetRequestController::class, 'forceDestroy']);
    Route::post('/asset-requests/{uuid}/approve', [AssetRequestController::class, 'approve']);
    Route::post('/asset-requests/{uuid}/reject', [AssetRequestController::class, 'reject']);
    Route::post('/asset-requests/{uuid}/allocate', [AssetRequestController::class, 'allocate']);
    Route::post('/asset-requests/{uuid}/return', [AssetRequestController::class, 'returnAsset']);

    Route::get('/stock-movements', [StockMovementController::class, 'index']);
    Route::get('/warehouse-material-stocks', [WarehouseMaterialStockController::class, 'index']);
    Route::get('/project-material-stocks', [ProjectMaterialStockController::class, 'index']);

    Route::get('/apartment-sales', [ApartmentSaleController::class, 'index']);
    Route::post('/apartment-sales', [ApartmentSaleController::class, 'store']);
    Route::put('/apartment-sales/{uuid}', [ApartmentSaleController::class, 'update']);
    Route::delete('/apartment-sales/{uuid}', [ApartmentSaleController::class, 'destroy']);
    Route::delete('/apartment-sales/{uuid}/force', [ApartmentSaleController::class, 'forceDestroy']);
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
    Route::delete('/notifications/read', [NotificationController::class, 'destroyRead']);
    Route::delete('/notifications/{id}', [NotificationController::class, 'destroy']);

    Route::get('/crm/messages', [CrmMessageController::class, 'index']);
    Route::post('/crm/messages', [CrmMessageController::class, 'store']);
    Route::post('/crm/messages/{id}/retry', [CrmMessageController::class, 'retry']);
    Route::post('/crm/reminders/run', [CrmMessageController::class, 'runInstallmentReminders']);

    Route::get('/documents', [DocumentController::class, 'index']);
    Route::get('/documents/reference-options', [DocumentController::class, 'referenceOptions']);
    Route::post('/documents', [DocumentController::class, 'store']);
    Route::delete('/documents/{id}', [DocumentController::class, 'destroy']);

    Route::post('/sync/push', [SyncController::class, 'push']);
    Route::get('/sync/pull', [SyncController::class, 'pull']);
});
