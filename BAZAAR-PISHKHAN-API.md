# API پیشخان بازار

API پیشخان بازار با هدف سهولت بیشتر در کار با پیشخان توسعه‌دهندگان بازار پیاده‌سازی شده است. با کمک این قابلیت می‌توانید برخی از امور مدیریت برنامه‌ی خود را بدون مراجعه به پیشخان و با استفاده از API انجام دهید.

دریافت توکن در پیشخان بازار

برای استفاده از API پیشخان بازار ابتدا باید برای هر برنامه یک توکن دریافت کنید. برای دریافت توکن مراحل زیر را طی کنید:

وارد پیشخان بازار شوید و روی برنامه‌ی خود کلیک کنید.

از منوی سمت راست صفحه، روی گزینه‌ی API پیشخان بازار کلیک کنید.

با کلیک روی گزینه‌ی «دریافت توکن جدید» در پیشخان می‌توانید برای برنامه‌ی خود توکن دریافت کنید.

در این صفحه همچنین می‌توانید توکن پیشین خود را حذف کنید.

پیشخان بازار

توکن دریافتی باید در هدر درخواست‌ها (Requests) با کلید CAFEBAZAAR-PISHKHAN-API-SECRET ارسال شود.

api-key

نمونه درخواست

curl --request GET \

--url https://api.pishkhan.cafebazaar.ir/v1/ENDPOINT/ \

--header 'CAFEBAZAAR-PISHKHAN-API-SECRET: TOKEN'کپی کردن

API پیشخان توسعه‌دهندگان بازار اکنون از چندین امکان مختلف، ازجمله «ایجاد رهانش»، «حذف رهانش»، «افزودن بسته به رهانش» و «ارسال درخواست برای بررسی رهانش» پشتیبانی می‌کند و به مرور قابلیت‌های دیگری نیز به آن افزوده می‌شود. شما نیز می‌‌توانید قابلیت‌های مورد نظر خود برای API پیشخان را درخواست بدهید. در ادامه، با هرکدام از امکانات API پیشخان بیشتر آشنا می‌شوید:

### ۱. ایجاد رهانش

درخواست‌ها:

با استفاده از این درخواست می‌توانید رهانش جدید ایجاد کنید:

پاسخ‌ها:

۲۰۱: درصورتی‌که رهانش با موفقیت ایجاد شود، این پاسخ ارسال می‌شود.

نمونه پاسخ:

{

"type": "success",

"message": "New Release successfully created.",

"release": {

"creation_date": "2021-07-18T16:24:25.944528",

"packages": [

{

"apk_size": 8801,

"sha1_hash": "CeFHTFKdmozjAcDUPGFIVlZqaBBcVDhpETDrErZV",

"version_code": 0,

"version_name": "XoTcPhBfKQFLDigPJSwVMfuNdDZtTnJhSAJCimJCFjzPcduiZxaPHPErZteLaXJ",

"api_level": 0,

"target_api_level": 718,

"upload_date": "2021-07-18",

"cpu_architectures": "",

"dpi": 1,

"locale": "en",

"additional_files": []

}

],

"auto_publish": false,

"staged_rollout_percentage": 100,

"changelog_fa": "",

"changelog_en": ""

}

}

کپی کردن

۴۰۰: در حالتی که درخواست ارسالی به سیستم نامعتبر باشد، این پاسخ ارسال می‌شود. برای بررسی دلیل رد‌شدن درخواست به پیام ارسالی مراجعه کنید.

نمونه پاسخ:

{

"type": "bad_request",

"message": "There is not an uncommitted release."

}

کپی کردن

۴۰۳: درصورتی‌که توکن در هدر درخواست ارسال نشود یا توکن ارسالی نامعتبر باشد، این پاسخ ارسال می‌شود:

نمونه پاسخ:

{

"type": "access_forbidden",

"message": "You do not have permission to perform this action."

}

کپی کردن

۴۲۹: درصورتی‌که تعداد درخواست‌ها به اندپوینت در یک بازه زمانی کوتاه زیاد باشد، این پاسخ ارسال می شود:

نمونه پاسخ:

{

"type": "too_many_requests",

"message": "Too many requests"

}

کپی کردن

### ۲. حذف رهانش

درخواست‌ها:

با این درخواست می‌توانید رهانش ایجاد‌شده‌ای که هنوز برای آن درخواست بررسی ارسال نشده را حذف کنید:

پاسخ‌ها:

۲۰۰: درصورتی‌که توکن در هدر درخواست ارسال نشود یا توکن ارسالی نامعتبر باشد، این پاسخ ارسال می‌شود:

{

"type": "success",

"message": "Release successfully deleted."

}

کپی کردن

نمونه پاسخ:

۴۰۰: در حالتی که درخواست ارسالی به سیستم نامعتبر باشد، این پاسخ ارسال می شود. برای بررسی دلیل رد‌شدن درخواست به پیام ارسالی مراجعه کنید.

نمونه پاسخ:

{

"type": "bad_request",

"message": "There is not an uncommitted release."

}

کپی کردن

۴۰۳: درصورتی‌که توکن در هدر درخواست ارسال نشود یا توکن ارسالی نامعتبر باشد، این پاسخ ارسال می‌شود.

نمونه پاسخ:

{

"type": "access_forbidden",

"message": "You do not have permission to perform this action."

}

کپی کردن

۴۲۹: درصورتی‌که تعداد درخواست‌ها به اندپوینت در یک بازه زمانی کوتاه زیاد باشد، این پاسخ ارسال می شود:

نمونه پاسخ:

{

"type": "too_many_requests",

"message": "Too many requests"

}

کپی کردن

### ۳. افزودن بسته APK

درخواست‌ها:

با این درخواست می‌توانید به رهانش ایجادشده بسته اضافه کنید.

نمونه درخواست:

{

"architecture": "all",

"apk": "<apk file>"

}

کپی کردن

curl --request POST \

--url https://api.pishkhan.cafebazaar.ir/v1/apps/releases/upload/ \

--header 'CAFEBAZAAR-PISHKHAN-API-SECRET: TOKEN' \

--header 'Content-Type: multipart/form-data' \

--form architecture=all \

--form 'apk=@/path/to/file.apk;type=application/vnd.android.package-archive'کپی کردن

پاسخ‌ها:

۲۰۰: درصورتی‌که درخواست بررسی با موفقیت ایجاد شود، این پاسخ ارسال می‌شود:

نمونه پاسخ:

{

"type": "success",

"message": "Package successfully added to release.",

"package": {

"apk_size": 1227887,

"sha1_hash": "5920f830cc5867d6f7304d70383f1337dab0822e",

"version_code": 1,

"version_name": "1.0",

"api_level": 25,

"target_api_level": 27,

"upload_date": "2021-07-18",

"cpu_architectures": "",

"dpi": 1,

"locale": "en",

"additional_files": []

}

}

کپی کردن

۴۰۰: در حالتی که درخواست ارسالی به سیستم نامعتبر باشد، این پاسخ ارسال می شود. برای بررسی دلیل رد‌شدن درخواست به پیام ارسالی مراجعه کنید.

نمونه پاسخ:

{

"type": "bad_request",

"message": "There is not an uncommitted release."

}

کپی کردن

۴۰۳: درصورتی‌که توکن در هدر درخواست ارسال نشود یا توکن ارسالی نامعتبر باشد، این پاسخ ارسال می‌شود:

نمونه پاسخ:

{

"type": "access_forbidden",

"message": "You do not have permission to perform this action."

}

کپی کردن

۴۲۹: در صورتی‌ که تعداد درخواست‌ها به اندپوینت در یک بازه زمانی کوتاه زیاد باشد، این پاسخ ارسال می شود:

نمونه پاسخ:

{

"type": "too_many_requests",

"message": "Too many requests"

}

کپی کردن

### ۴. افزودن بسته AAB

شما می‌توانید با سه مرحله‌ی زیر، برنامه‌ی خود را به صورت باندل از طریق API به رهانش خود اضافه کنید. روند کلی مراحل در نمودار زیر قابل مشاهده است:

اطلاعات باندل

### ۴.۱. افزودن فایل باندل

درخواست‌ها:

با این درخواست می‌توانید به رهانش ایجادشده بسته اضافه کنید.

نمونه درخواست:

{

"aab": "<aab file>"

}

کپی کردن

curl --request POST \

--url https://api.pishkhan.cafebazaar.ir/v1/apps/releases/upload-aab/ \

--header 'CAFEBAZAAR-PISHKHAN-API-SECRET: TOKEN' \

--header 'Content-Type: multipart/form-data' \

--form aab=@/path/to/file.aabکپی کردن

پاسخ‌ها:

۲۰۰: درصورتی‌که فایل باندل با موفقیت افزوده شود، این پاسخ ارسال می‌شود:

نمونه پاسخ:

{

"type": "success",

"message": "AAB file successfully added to release.",

"bundle": {

"state": "U",

"errors": null

},

"warnings": []

}کپی کردن

۴۰۰: در حالتی که درخواست ارسالی به سیستم نامعتبر باشد، این پاسخ ارسال می شود. برای بررسی دلیل رد‌شدن درخواست به پیام ارسالی مراجعه کنید.

نمونه پاسخ:

{

"type": "bad_request",

"message": "There is not an uncommitted release."

}

کپی کردن

۴۰۳: درصورتی‌که توکن در هدر درخواست ارسال نشود، توکن ارسالی نامعتبر باشد و یا برنامه در حالت مجاز برای قراردادن بسته نباشد، این پاسخ ارسال می‌شود:

نمونه پاسخ:

{

"type": "access_forbidden",

"message": "You do not have permission to perform this action."

}

کپی کردن

۴۲۹: در صورتی‌ که تعداد درخواست‌ها به اندپوینت در یک بازه زمانی کوتاه زیاد باشد، این پاسخ ارسال می شود:

نمونه پاسخ:

{

"type": "too_many_requests",

"message": "Too many requests"

}

کپی کردن

### ۴.۲. اضافه کردن فایل bin

درخواست‌ها:

با این درخواست می‌توانید فایل bin تولیدشده توسط ابزار Bundle Signer را به فایل aab آپلودشده در مرحله‌ی قبل برای تولید بسته‌ها اضافه کنید.

نمونه درخواست:

{

"file": "<bin file>"

}

کپی کردن

curl --request POST \

--url https://api.pishkhan.cafebazaar.ir/v1/apps/releases/upload-bin/ \

--header 'CAFEBAZAAR-PISHKHAN-API-SECRET: TOKEN' \

--header 'Content-Type: multipart/form-data' \

--form file=@/path/to/file.binکپی کردن

پاسخ‌ها:

۲۰۰: درصورتی‌که فایل bin با موفقیت افزوده شود، این پاسخ ارسال می‌شود:

نمونه پاسخ:

{

"type": "success",

"message": "Bin file successfully uploaded.",

"bundle": {

"state": "S",

"errors": null

}

}کپی کردن

۴۰۰: در حالتی که درخواست ارسالی به سیستم نامعتبر باشد، این پاسخ ارسال می شود. برای بررسی دلیل رد‌شدن درخواست به پیام ارسالی مراجعه کنید.

نمونه پاسخ:

{

"type": "bad_request",

"message": "There is not an uncommitted release."

}

کپی کردن

۴۰۳: درصورتی‌که توکن در هدر درخواست ارسال نشود یا توکن ارسالی نامعتبر باشد، این پاسخ ارسال می‌شود:

نمونه پاسخ:

{

"type": "access_forbidden",

"message": "You do not have permission to perform this action."

}

کپی کردن

۴۲۹: در صورتی‌ که تعداد درخواست‌ها به اندپوینت در یک بازه زمانی کوتاه زیاد باشد، این پاسخ ارسال می شود:

نمونه پاسخ:

{

"type": "too_many_requests",

"message": "Too many requests"

}

کپی کردن

### ۴.۳. بررسی وضعیت پردازش باندل

درخواست‌ها:

با این درخواست می‌توانید وضعیت پردازش باندل خود را پس از آپلود فایل AAB و bin در مراحل قبل، بررسی کنید.

نمونه درخواست:

curl --request GET \

--url https://api.pishkhan.cafebazaar.ir/v1/apps/releases/bundle-status/ \

--header 'CAFEBAZAAR-PISHKHAN-API-SECRET: TOKEN'کپی کردن

پاسخ‌ها:

۲۰۰: درصورتی‌که وضعیت پردازش باندل با موفقیت دریافت شود، این پاسخ ارسال می‌شود:

نمونه پاسخ:

{

"type": "success",

"message": "Bundle release status successfully retrieved.",

"bundle": {

"state": "D",

"errors": null

}

}کپی کردن

۴۰۰: در حالتی که درخواست ارسالی به سیستم نامعتبر باشد، این پاسخ ارسال می شود. برای بررسی دلیل رد‌شدن درخواست به پیام ارسالی مراجعه کنید.

نمونه پاسخ:

{

"type": "bad_request",

"message": "There is not an uncommitted release."

}

کپی کردن

۴۰۳: درصورتی‌که توکن در هدر درخواست ارسال نشود یا توکن ارسالی نامعتبر باشد، این پاسخ ارسال می‌شود:

نمونه پاسخ:

{

"type": "access_forbidden",

"message": "You do not have permission to perform this action."

}

کپی کردن

۴۲۹: در صورتی‌ که تعداد درخواست‌ها به اندپوینت در یک بازه زمانی کوتاه زیاد باشد، این پاسخ ارسال می شود:

نمونه پاسخ:

{

"type": "too_many_requests",

"message": "Too many requests"

}

کپی کردن

### ۵. درخواست بررسی

درخواست‌ها

با این درخواست می‌توانید رهانش ایجاد شده را برای بررسی ارسال کنید (درخواست انتشار بدهید):

نمونه درخواست:

{

"changelog_en": "cool new things added",

"changelog_fa": "چیزهای باحال جدید اضافه شد",

"developer_note": "Fixes #1",

"staged_rollout_percentage": 10

"auto_publish": true

}

کپی کردن

پاسخ‌ها:

۲۰۰: درصورتی‌که درخواست بررسی با موفقیت ایجاد شود، این پاسخ ارسال می‌شود:

نمونه پاسخ:

{

"type": "success",

"message": "Release successfully committed.",

"release": {

"id": 159,

"release_state": "Active",

"creation_date": "2021-07-18T16:24:20.868758",

"committed": true,

"packages": [

{

"apk_size": 8801,

"sha1_hash": "CeFHTFKdmozjAcDUPGFIVlZqaBBcVDhpETDrErZV",

"version_code": 0,

"version_name": "XoTcPhBfKQFLDigPJSwVMfuNdDZtTnJhSAJCimJCFjzPcduiZxaPHPErZteLaXJ",

"api_level": 0,

"target_api_level": 718,

"upload_date": "2021-07-18",

"cpu_architectures": "",

"dpi": 1,

"locale": "en",

"additional_files": []

}

],

"auto_publish": false,

"staged_rollout_percentage": 10,

"changelog_fa": "چیزهای باحال جدید اضافه شد",

"changelog_en": "cool new things added"

}

}

کپی کردن

۴۰۰: در حالتی که درخواست ارسالی به سیستم نامعتبر باشد، این پاسخ ارسال می شود. برای بررسی دلیل رد‌شدن درخواست به پیام ارسالی مراجعه کنید.

نمونه پاسخ:

{

"type": "bad_request",

"message": "There is not an uncommitted release."

}

کپی کردن

۴۰۳: درصورتی‌که توکن در هدر درخواست ارسال نشود یا توکن ارسالی نامعتبر باشد، این پاسخ ارسال می‌شود:

نمونه پاسخ:

{

"type": "access_forbidden",

"message": "You do not have permission to perform this action."

}

کپی کردن

۴۲۹: درصورتی‌که تعداد درخواست‌ها به اندپوینت در یک بازه زمانی کوتاه زیاد باشد، این پاسخ ارسال می شود:

نمونه پاسخ:

{

"type": "too_many_requests",

"message": "Too many requests"

}

کپی کردن

### ۶. دریافت آخرین رهانش کامیت‌شده

با این درخواست می‌توانید آخرین رهانش کامیت‌شده (Committed) را دریافت کنید:

پاسخ‌ها:

۲۰۰: درصورتی‌که در لیست رهانش‌ها رهانش کامیت‌شده وجود داشته باشد، اطلاعات این رهانش در پاسخ ارسال می‌شود. در این حالت کلید type در پاسخ ارسالی success خواهد بود.

درصورتی‌که در لیست رهانش‌ها، رهانش کامیت‌شده‌ای وجود نداشته باشد، در پاسخ کلید type برابر not-exists خواهد بود.

نمونه پاسخ:

{

"type": "success",

"message": "Last committed release successfully retrived.",

"release": {

"creation_date": "2021-10-08T12:28:26.504947",

"packages": [

{

"additional_files": [],

"apk_size": 3164,

"sha1_hash": "AXzmIPJbUSrAAgmJFQyWVXIKHOQLDORunKUwRrAM",

"version_code": 3,

"version_name": "IdkQXoiuziwIVGDnLfOAIqrvXmOSWMYoqpvpzVedXQjhpSmCCXvuUbixAXJhnON",

"api_level": 0,

"target_api_level": 4036,

"upload_date": "2021-10-09",

"cpu_architectures": "",

"dpi": 1,

"locale": "en"

}

],

"auto_publish": false,

"staged_rollout_percentage": 100,

"changelog_fa": null,

"changelog_en": ""

}

}

کپی کردن

### ۷. دریافت آخرین رهانش کامیت‌نشده

با این درخواست می توانید آخرین رهانش کامیت‌نشده  (uncommitted) را دریافت کنید:

پاسخ‌ها:

۲۰۰: درصورتی‌که در لیست رهانش‌ها، رهانش کامیت‌شده وجود داشته باشد، اطلاعات این رهانش در پاسخ ارسال می‌شود‌. دراین حالت کلید type در پاسخ ارسالی success خواهد بود.

درصورتی‌که در لیست رهانش‌ها، رهانش کامیت‌شده وجود نداشته باشد، در پاسخ کلید type برابر not-exists خواهد بود.

نمونه پاسخ:

{

"type": "success",

"message": "Last uncommitted release successfully retrived.",

"release": {

"creation_date": "2021-10-08T12:28:26.504947",

"packages": [

{

"additional_files": [],

"apk_size": 3164,

"sha1_hash": "AXzmIPJbUSrAAgmJFQyWVXIKHOQLDORunKUwRrAM",

"version_code": 3,

"version_name": "IdkQXoiuziwIVGDnLfOAIqrvXmOSWMYoqpvpzVedXQjhpSmCCXvuUbixAXJhnON",

"api_level": 0,

"target_api_level": 4036,

"upload_date": "2021-10-09",

"cpu_architectures": "",

"dpi": 1,

"locale": "en"

}

],

"auto_publish": false,

"staged_rollout_percentage": 100,

"changelog_fa": null,

"changelog_en": ""

}

}

کپی کردن

### ۸. دریافت آخرین رهانش منتشر‌شده

با این درخواست می‌توانید آخرین رهانش منتشرشده (published) را دریافت کنید:

پاسخ‌ها:

۲۰۰: درصورتی‌که در لیست رهانش‌ها رهانش کامیت‌شده وجود داشته باشد، اطلاعات این رهانش در پاسخ ارسال می‌شود. در این حالت کلید type در پاسخ ارسالی success خواهد بود.

درصورتی‌که در لیست رهانش‌ها رهانش کامیت‌شده وجود نداشته باشد در پاسخ کلید type برابر not-exists خواهد بود.

نمونه پاسخ:

{

"type": "success",

"message": "Last published release successfully retrived.",

"release": {

"creation_date": "2021-10-08T12:28:26.504947",

"packages": [

{

"additional_files": [],

"apk_size": 3164,

"sha1_hash": "AXzmIPJbUSrAAgmJFQyWVXIKHOQLDORunKUwRrAM",

"version_code": 3,

"version_name": "IdkQXoiuziwIVGDnLfOAIqrvXmOSWMYoqpvpzVedXQjhpSmCCXvuUbixAXJhnON",

"api_level": 0,

"target_api_level": 4036,

"upload_date": "2021-10-09",

"cpu_architectures": "",

"dpi": 1,

"locale": "en"

}

],

"auto_publish": false,

"staged_rollout_percentage": 100,

"changelog_fa": null,

"changelog_en": ""

}

}

کپی کردن


جدول 1


نکته: توجه داشته باشید که هر توکن دریافتی، مختص همان برنامه است.


جدول 2


API Key | Security Scheme Type

CAFEBAZAAR-PISHKHAN-API-SECRET | Header Parameter name


جدول 3


https://api.pishkhan.cafebazaar.ir/v1/apps/releases/ | URL

POST | Request type

api-key | AUTHORIZATIONS

application/json | Response type


جدول 4


Success - این پیام متناسب با نوع پاسخ است | string | type

New Release successfully created - این پیام متناسب با نوع پاسخ است | string | message

تاریخ ایجاد رهانش | string | creation_date

لیست بسته‌های بارگذاری شده در رهانش (زمان ایجاد رهانش این فیلد خالی است) | list | packages

انتشار خودکار رهانش | bool | auto_publish

درصد رهانش تدریجی (زمان ایجاد رهانش این درصد روی ۱۰۰ تنظیم شده است. اگر شرایط استفاده از رهانش تدریجی را دارید، می‌توانید زمان ارسال درخواست انتشار، مقدار آن را تنظیم کنید.) | int | staged_rollout_percentage

توضیحات فارسی برای رهانش (زمان ایجاد رهانش این فیلد خالی است. زمان ارسال درخواست انتشار، می‌توانید مقدار این فیلد را تعیین کنید.) | string | changelog_fa

توضیحات انگلیسی برای رهانش (زمان ایجاد رهانش این فیلد خالی است. زمان ارسال درخواست انتشار می‌توانید مقدار این فیلد را تعیین کنید.) | string | changelog_en


جدول 5


این پیام متناسب با نوع پاسخ است | string | type

این پیام متناسب با نوع پاسخ است | string | message


جدول 6


این پیام متناسب با نوع پاسخ است | string | type

این پیام متناسب با نوع پاسخ است | string | message


جدول 7


این پیام متناسب با نوع پاسخ است | string | type

این پیام متناسب با نوع پاسخ است | string | message


جدول 8


https://api.pishkhan.cafebazaar.ir/v1/apps/releases/ | URL

DELETE | Request type

api-key | AUTHORIZATIONS

application/json | Response type


جدول 9


این پیام متناسب با نوع پاسخ است | string | type

این پیام متناسب با نوع پاسخ است | string | message


جدول 10


این پیام متناسب با نوع پاسخ است | string | type

این پیام متناسب با نوع پاسخ است | string | message


جدول 11


این پیام متناسب با نوع پاسخ است | string | type

این پیام متناسب با نوع پاسخ است | string | message


جدول 12


این پیام متناسب با نوع پاسخ است | string | type

این پیام متناسب با نوع پاسخ است | string | message


جدول 13


https://api.pishkhan.cafebazaar.ir/v1/apps/releases/upload/ | URL

POST | Request type

api-key | AUTHORIZATIONS

multipart/form-data | REQUEST BODY SCHEMA

application/json | Response type


جدول 14


نوع معماری پردازنده برای بسته را مشخص کنید. / Enum: "all" "armeabi-v7a" "arm64-v8a" / architecture | string | architecture

فایل ‌apk | <string<binary | apk


جدول 15


این پیام متناسب با نوع پاسخ است - Success | string | type

این پیام متناسب با نوع پاسخ است - Package successfully added to release | string | message

حجم بسته | int | apk_size

| string | sha1_hash

شماره نسخه بسته | int | version_code

نام نسخه بسته | string | version_name

Api level بسته | int | api_level

Target api level بسته | int | target_api_level

تاریخ بارگذاری بسته | string | upload_date

معماری پردازنده متناسب با بسته | string | cpu_architectures

فایل‌های پیوست بسته (در این نسخه از api امکان بارگذاری فایل‌‌های پیوست وجود ندارد. برای بارگذاری فایل‌های پیوست می‌توانید پیش از ارسال درخواست انتشار به بخش رهانش‌های پیشخان بازار مراجعه و فایل‌های پیوست را مطابق راهنمای آن بارگذاری کنید.) | list | additional_files


جدول 16


این پیام متناسب با نوع پاسخ است | string | type

این پیام متناسب با نوع پاسخ است | string | message


جدول 17


این پیام متناسب با نوع پاسخ است | string | type

این پیام متناسب با نوع پاسخ است | string | message


جدول 18


این پیام متناسب با نوع پاسخ است | string | type

این پیام متناسب با نوع پاسخ است | string | message


جدول 19


مقدار بازگشتی bundle که در پاسخ موفق درخواست‌های مربوط به باندل بازمی‌گردد، دارای ساختار زیر است:


جدول 20


توضیحات | type | field

حالت کنونی وضعیت پردازش باندل را نشان می‌دهد. (جزییات توضیح مقادیر ممکن در جدول پایین.) | string | state

لیستی از مشکلات موجود در فایل‌های ارسالی AAB و bin پس از پردازش ناموفق. | list | errors


جدول 21


توضیحات | مقدار state

فایل AAB به درستی آپلود شده است و پردازش منتظر فایل bin است. | U

فایل bin به درستی آپلود شده‌است و منتظر امضاشدن توسط سیستم است. | S

فایل در حال پردازش جهت امضاشدن است. | P

پردازش با موفقیت به پایان رسیده‌است. | D

پردازش با خطا مواجه شده‌است. | E


جدول 22


https://api.pishkhan.cafebazaar.ir/v1/apps/releases/upload-aab/ | URL

POST | Request type

api-key | AUTHORIZATIONS

multipart/form-data | REQUEST BODY SCHEMA

application/json | Response type


جدول 23


فایل ‌aab | <string<binary | aab


جدول 24


این پیام متناسب با نوع پاسخ است - Success | string | type

این پیام متناسب با نوع پاسخ است - AAB file successfully added to release. | string | message

اطلاعات باندل | object | bundle

اخطارهای افزودن فایل | list | warnings


جدول 25


این پیام متناسب با نوع پاسخ است | string | type

این پیام متناسب با نوع پاسخ است | string | message


جدول 26


این پیام متناسب با نوع پاسخ است | string | type

این پیام متناسب با نوع پاسخ است | string | message


جدول 27


این پیام متناسب با نوع پاسخ است | string | type

این پیام متناسب با نوع پاسخ است | string | message


جدول 28


https://api.pishkhan.cafebazaar.ir/v1/apps/releases/upload-bin/ | URL

POST | Request type

api-key | AUTHORIZATIONS

multipart/form-data | REQUEST BODY SCHEMA

application/json | Response type


جدول 29


فایل ‌bin | <string<binary | file


جدول 30


این پیام متناسب با نوع پاسخ است - Success | string | type

این پیام متناسب با نوع پاسخ است - Bin file successfully uploaded. | string | message

اطلاعات باندل | object | bundle


جدول 31


این پیام متناسب با نوع پاسخ است | string | type

این پیام متناسب با نوع پاسخ است | string | message


جدول 32


این پیام متناسب با نوع پاسخ است | string | type

این پیام متناسب با نوع پاسخ است | string | message


جدول 33


این پیام متناسب با نوع پاسخ است | string | type

این پیام متناسب با نوع پاسخ است | string | message


جدول 34


نکته: پس از افزودن فایل bin، پیشنهاد می‌شود که حداکثر در هر دقیقه یکبار، این اندپوینت را تا دریافت اتمام پردازش (state=D) فراخوانی کنید.


جدول 35


https://api.pishkhan.cafebazaar.ir/v1/apps/releases/bundle-status/ | URL

GET | Request type

api-key | AUTHORIZATIONS

application/json | Response type


جدول 36


این پیام متناسب با نوع پاسخ است - Success | string | type

این پیام متناسب با نوع پاسخ است - Bundle release status successfully retrieved. | string | message

اطلاعات باندل | object | bundle


جدول 37


این پیام متناسب با نوع پاسخ است | string | type

این پیام متناسب با نوع پاسخ است | string | message


جدول 38


این پیام متناسب با نوع پاسخ است | string | type

این پیام متناسب با نوع پاسخ است | string | message


جدول 39


این پیام متناسب با نوع پاسخ است | string | type

این پیام متناسب با نوع پاسخ است | string | message


جدول 40


https://api.pishkhan.cafebazaar.ir/v1/apps/releases/commit/ | URL

POST | Request type

api-key | AUTHORIZATIONS

application/json | REQUEST BODY SCHEMA

application/json | Response type


جدول 41


درصد رهانش تدریجی (زمان ایجاد رهانش این درصد روی ۱۰۰ تنظیم شده است. اگر شرایط استفاده از رهانش تدریجی را دارید، می‌توانید زمان ارسال درخواست انتشار، مقدار آن را تنظیم کنید.) | int | staged_rollout_percentage

توضیحات فارسی برای رهانش | string | changelog_fa

توضیحات انگلیسی برای رهانش | string | changelog_en

یادداشت توسعه‌دهنده برای تیم بررسی | string | developer_note

فعال یا غیرفعال‌کردن انتشار خودکار رهانش | bool | auto_publish


جدول 42


نکته: درصورتی‌که متغیر auto_publish برابر با true باشد، برنامه پس از تأیید درخواست بررسی به‌صورت خودکار در بازار منتشر خواهد شد. اما اگر متغیر auto_publish برابر با false باشد، پس از تأیید درخواست بررسی باید به قسمت رهانش برنامه در پیشخان مراجعه و با کلیک روی گزینه‌ی «انتشار رهانش» برنامه را منتشر کنید.


جدول 43


Success - این پیام متناسب با نوع پاسخ است | string | type

Release successfully committed. - این پیام متناسب با نوع پاسخ است | string | message

تاریخ ایجاد رهانش | string | creation_date

لیست بسته‌های بارگذاری‌شده در رهانش | list | packages

انتشار خودکار رهانش | bool | auto_publish

درصد رهانش تدریجی | int | staged_rollout_percentage

توضیحات فارسی برای رهانش | string | changelog_fa

توضیحات انگلیسی برای رهانش | string | changelog_en


جدول 44


این پیام متناسب با نوع پاسخ است | string | type

این پیام متناسب با نوع پاسخ است | string | message


جدول 45


این پیام متناسب با نوع پاسخ است | string | type

این پیام متناسب با نوع پاسخ است | string | message


جدول 46


این پیام متناسب با نوع پاسخ است | string | type

این پیام متناسب با نوع پاسخ است | string | message


جدول 47


https://api.pishkhan.cafebazaar.ir/v1/apps/releases/last-committed/ | URL

GET | Request type

api-key | AUTHORIZATIONS

application/json | Response type


جدول 48


Success - این پیام متناسب با نوع پاسخ است | string | type

این پیام متناسب با نوع پاسخ است | string | message

تاریخ ایجاد رهانش | string | creation_date

لیست بسته‌های بارگذاری‌شده در رهانش | list | packages

حجم بسته | int | apk_size

| string | sha1_hash

شماره نسخه بسته | int | version_code

نام نسخه بسته | string | version_name

Api level بسته | int | api_level

Target api level بسته | int | target_api_level

تاریخ بارگذاری بسته | string | upload_date

معماری پردازنده متناسب با بسته | string | cpu_architectures

فایل‌های پیوست بسته (در این نسخه از api امکان بارگذاری فایل‌‌های پیوست وجود ندارد. برای بارگذاری فایل‌های پیوست می‌توانید پیش از ارسال درخواست انتشار به بخش رهانش‌های پیشخان بازار مراجعه و فایل‌های پیوست را مطابق راهنمای آن بارگذاری کنید.) | list | additional_files

انتشار خودکار رهانش (در این نسخه از api امکان فعال‌کردن انتشار خودکار وجود ندارد) | bool | auto_publish

درصد رهانش تدریجی | int | staged_rollout_percentage

توضیحات فارسی برای رهانش | string | changelog_fa

توضیحات انگلیسی برای رهانش | string | changelog_en


جدول 49


https://api.pishkhan.cafebazaar.ir/v1/apps/releases/last-uncommitted/ | URL

GET | Request type

api-key | AUTHORIZATIONS

application/json | Response type


جدول 50


Success - این پیام متناسب با نوع پاسخ است | string | type

این پیام متناسب با نوع پاسخ است | string | message

تاریخ ایجاد رهانش | string | creation_date

لیست بسته‌های بارگذاری شده در رهانش | list | packages

حجم بسته | int | apk_size

| string | sha1_hash

شماره نسخه بسته | int | version_code

نام نسخه بسته | string | version_name

Api level بسته | int | api_level

Target api level بسته | int | target_api_level

تاریخ بارگذاری بسته | string | upload_date

معماری پردازنده متناسب با بسته | string | cpu_architectures

فایل‌های پیوست بسته (در این نسخه از api امکان بارگذاری فایل‌‌های پیوست وجود ندارد. برای بارگذاری فایل‌های پیوست می‌توانید پیش از ارسال درخواست انتشار به بخش رهانش‌های پیشخان بازار مراجعه و فایل‌های پیوست را مطابق راهنمای آن بارگذاری کنید.) | list | additional_files

انتشار خودکار رهانش | bool | auto_publish

درصد رهانش تدریجی | int | staged_rollout_percentage

توضیحات فارسی برای رهانش | string | changelog_fa

توضیحات انگلیسی برای رهانش | string | changelog_en


جدول 51


https://api.pishkhan.cafebazaar.ir/v1/apps/releases/last-published/ | URL

GET | Request type

api-key | AUTHORIZATIONS

application/json | Response type


جدول 52


Success - این پیام متناسب با نوع پاسخ است | string | type

این پیام متناسب با نوع پاسخ است | string | message

تاریخ ایجاد رهانش | string | creation_date

لیست بسته‌های بارگذاری‌شده در رهانش | list | packages

حجم بسته | int | apk_size

| string | sha1_hash

شماره نسخه بسته | int | version_code

نام نسخه بسته | string | version_name

Api level بسته | int | api_level

Target api level بسته | int | target_api_level

تاریخ بارگذاری بسته | string | upload_date

معماری پردازنده متناسب با بسته | string | cpu_architectures

فایل‌های پیوست بسته (در این نسخه از api امکان بارگذاری فایل‌‌های پیوست وجود ندارد. برای بارگذاری فایل‌های پیوست می‌توانید پیش از ارسال درخواست انتشار به بخش رهانش‌های پیشخان بازار مراجعه و فایل‌های پیوست را مطابق راهنمای آن بارگذاری کنید.) | list | additional_files

انتشار خودکار رهانش | bool | auto_publish

درصد رهانش تدریجی | int | staged_rollout_percentage

توضیحات فارسی برای رهانش | string | changelog_fa

توضیحات انگلیسی برای رهانش | string | changelog_en
