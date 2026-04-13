<?php

use App\Models\Roles;
use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;

return new class extends Migration
{
    private array $permissions = [
        'accounts.view',
        'accounts.create',
        'accounts.update',
        'account_transactions.view',
    ];

    public function up(): void
    {
        foreach ($this->permissions as $permissionName) {
            Permission::findOrCreate($permissionName, 'web');
        }

        $roles = Roles::query()
            ->whereIn('name', ['Admin', 'Accountant'])
            ->get();

        foreach ($roles as $role) {
            $role->givePermissionTo($this->permissions);
        }
    }

    public function down(): void
    {
        $roles = Roles::query()
            ->whereIn('name', ['Admin', 'Accountant'])
            ->get();

        foreach ($roles as $role) {
            $role->revokePermissionTo($this->permissions);
        }

        Permission::query()
            ->whereIn('name', $this->permissions)
            ->where('guard_name', 'web')
            ->delete();
    }
};
