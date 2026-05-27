FROM php:8.4-fpm-alpine

# System deps + PHP extensions
RUN apk add --no-cache \
        bash \
        git \
        unzip \
        postgresql-dev \
        icu-dev \
        linux-headers \
        autoconf \
        g++ \
        make \
    && docker-php-ext-configure intl \
    && docker-php-ext-install \
        pdo \
        pdo_pgsql \
        intl \
        opcache \
    # Xdebug for local dev
    && pecl install xdebug \
    && docker-php-ext-enable xdebug

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

COPY docker/php/php.ini /usr/local/etc/php/conf.d/app.ini

WORKDIR /var/www/html

CMD ["php-fpm"]
