# TODO - create different cloudfront distributions and S3 buckets for static files in different environments

import sys
sys.path.append('.')
from no8am.minify import update_static_files


# TODO - improve workaround to get multiple scheduled events for the same function
def update_static_files_wrapper():
    update_static_files()


def update_static_files_wrapper_b():
    update_static_files()


def update_static_files_wrapper_c():
    update_static_files()


def update_static_files_wrapper_d():
    update_static_files()


# TODO - implement post upload callback that creates a base path mapping, if it doesn't exist
def create_base_path_mapping():
    pass
    # import boto3
    # from botocore.exceptions import ClientError
    # api_gateway = boto3.client('apigateway')
    # # base_path_mappings = api_gateway.get_base_path_mappings(domainName='no8.am', position='')
    #
    # try:
    #     response = api_gateway.create_base_path_mapping(domainName='no8.am', basePath='', stage='production', restApiId='htwh6i3pwf')
    #     print "base path map created"
    # except ClientError as error:
    #     print error.message
