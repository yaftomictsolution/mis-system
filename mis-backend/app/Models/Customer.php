<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Customer extends Model
{
    use SoftDeletes;

    protected $table ='customers';
    protected $fillable = ['uuid','name','fname','gname','phone','phone1','email','address','status'];
}
