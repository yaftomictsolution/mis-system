<?php

namespace App\Models;

use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Permission\Models\Role as SpatieRole;

class Roles extends SpatieRole
{
    use SoftDeletes;

    protected $fillable = ['uuid', 'name', 'guard_name'];
}
