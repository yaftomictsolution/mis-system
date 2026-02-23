<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Customer extends Model
{
    protected $table ='customers';
    protected $fillable = ['uuid','name','fname','gname','phone','phone1','email','address','status'];
}
